import { createHash } from "node:crypto";
import {
  ConflictException,
  GoneException,
  Inject,
  Injectable,
  NotFoundException,
  Scope,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { REQUEST } from "@nestjs/core";
import { Temporal } from "temporal-polyfill";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { DATABASE } from "../database.module.js";
import type { Database } from "../database/client.js";
import { InvoiceExportQueue } from "./invoice-export.queue.js";
import { InvoiceExportStorageService } from "./invoice-export-storage.service.js";
import type { CreateInvoiceExportDto } from "./invoice-export.dto.js";

export const EXPORT_RETENTION_HOURS = (() => {
  const value = Number(process.env.INVOICE_EXPORT_RETENTION_HOURS ?? 24);
  if (!Number.isInteger(value) || value < 1 || value > 168)
    throw new Error("INVOICE_EXPORT_RETENTION_HOURS must be from 1 to 168");
  return value;
})();

@Injectable({ scope: Scope.REQUEST })
export class InvoiceExportsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(REQUEST) private readonly request: AuthenticatedRequest,
    private readonly queue: InvoiceExportQueue,
    private readonly storage: InvoiceExportStorageService,
  ) {}

  private get tenant() {
    if (!this.request.auth) throw new UnauthorizedException();
    return this.request.auth;
  }

  private response(record: {
    id: string;
    status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" | "EXPIRED";
    progress: number;
    archiveName: string | null;
    archiveSize: number | null;
    failureCode: string | null;
    expiresAt: { toString(): string };
    createdAt: { toString(): string };
    completedAt: { toString(): string } | null;
  }) {
    const expired =
      Temporal.Instant.compare(
        Temporal.Instant.from(record.expiresAt.toString()),
        Temporal.Now.instant(),
      ) <= 0;
    return {
      jobId: record.id,
      status: expired && record.status === "COMPLETED" ? "EXPIRED" : record.status,
      progress: record.progress,
      filename: record.archiveName,
      size: record.archiveSize,
      error: record.status === "FAILED" ? record.failureCode : null,
      expiresAt: record.expiresAt.toString(),
      createdAt: record.createdAt.toString(),
      completedAt: record.completedAt?.toString() ?? null,
    };
  }

  async create(input: CreateInvoiceExportDto) {
    const { organizationId, userId } = this.tenant;
    const invoiceIds = [...input.invoiceIds].sort();
    const fingerprint = createHash("sha256").update(invoiceIds.join("\n")).digest("hex");
    let record = await this.db.orm.public.InvoiceExport.where({
      organizationId,
      requestId: input.requestId,
    }).first();
    if (record) {
      if (record.requestedByUserId !== userId || record.requestFingerprint !== fingerprint)
        throw new ConflictException("Export request ID is already in use");
      if (record.status === "FAILED") {
        const [queued] = await this.db.orm.public.InvoiceExport.where({
          organizationId,
          id: record.id,
          requestedByUserId: userId,
          status: "FAILED",
        }).updateAll({ status: "QUEUED", progress: 0, failureCode: null });
        if (queued) record = queued;
      }
      if (record.status === "QUEUED")
        await this.queue.enqueue({ exportId: record.id, organizationId });
      return this.response(record);
    }

    const invoices = await this.db.orm.public.Invoice.where({ organizationId })
      .where((row) => row.id.in(invoiceIds))
      .select("id", "status", "issuedAt")
      .all();
    if (
      invoices.length !== invoiceIds.length ||
      invoices.some(
        (invoice) => !invoice.issuedAt || !["ISSUED", "PAID", "OVERDUE"].includes(invoice.status),
      )
    )
      throw new NotFoundException("One or more eligible invoices were not found");

    try {
      record = await this.db.orm.public.InvoiceExport.create({
        organizationId,
        requestedByUserId: userId,
        requestId: input.requestId,
        requestFingerprint: fingerprint,
        invoiceIds: JSON.stringify(invoiceIds),
        status: "QUEUED",
        progress: 0,
        expiresAt: Temporal.Now.instant().add({ hours: EXPORT_RETENTION_HOURS }),
      });
    } catch (error) {
      const concurrent = await this.db.orm.public.InvoiceExport.where({
        organizationId,
        requestId: input.requestId,
      }).first();
      if (
        !concurrent ||
        concurrent.requestedByUserId !== userId ||
        concurrent.requestFingerprint !== fingerprint
      )
        throw error;
      record = concurrent;
    }
    try {
      await this.queue.enqueue({ exportId: record.id, organizationId });
    } catch (error) {
      await this.db.orm.public.InvoiceExport.where({
        organizationId,
        id: record.id,
      }).updateAll({ status: "FAILED", failureCode: "QUEUE_UNAVAILABLE" });
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException("Invoice export queue is unavailable");
    }
    return this.response(record);
  }

  async get(jobId: string) {
    const { organizationId, userId } = this.tenant;
    const record = await this.db.orm.public.InvoiceExport.where({
      organizationId,
      requestedByUserId: userId,
      id: jobId,
    }).first();
    if (!record) throw new NotFoundException("Invoice export not found");
    return this.response(record);
  }

  async download(jobId: string) {
    const { organizationId, userId } = this.tenant;
    const record = await this.db.orm.public.InvoiceExport.where({
      organizationId,
      requestedByUserId: userId,
      id: jobId,
    }).first();
    if (!record) throw new NotFoundException("Invoice export not found");
    if (
      Temporal.Instant.compare(
        Temporal.Instant.from(record.expiresAt.toString()),
        Temporal.Now.instant(),
      ) <= 0
    )
      throw new GoneException("Invoice export has expired");
    if (record.status !== "COMPLETED" || !record.archiveKey)
      throw new ConflictException("Invoice export is not ready");
    const stored = await this.storage.download(record.archiveKey, organizationId, record.id);
    return {
      ...stored,
      filename: record.archiveName ?? `invoice-export-${record.id}.zip`,
    };
  }
}
