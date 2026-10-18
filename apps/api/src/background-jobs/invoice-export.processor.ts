import { Inject, Injectable, Logger } from "@nestjs/common";
import { Worker, type Job } from "bullmq";
import archiver from "archiver";
import { Transform } from "node:stream";
import { Temporal } from "temporal-polyfill";
import { DATABASE } from "../database.module.js";
import type { Database } from "../database/client.js";
import { InvoicePdfResolverService } from "../invoices/pdf/invoice-pdf-resolver.service.js";
import {
  bullConnection,
  bullPrefix,
  exportWorkerConcurrency,
  INVOICE_EXPORT_QUEUE,
} from "./bullmq.config.js";
import type { InvoiceExportJob } from "./invoice-export.queue.js";
import { InvoiceExportStorageService } from "./invoice-export-storage.service.js";

export const MAX_EXPORT_BYTES = 100 * 1024 * 1024;
const METADATA_RETENTION_DAYS = 7;

@Injectable()
export class InvoiceExportProcessor {
  private readonly logger = new Logger(InvoiceExportProcessor.name);
  private worker?: Worker<InvoiceExportJob>;

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly pdfs: InvoicePdfResolverService,
    private readonly storage: InvoiceExportStorageService,
  ) {}

  async start() {
    this.worker = new Worker<InvoiceExportJob>(
      INVOICE_EXPORT_QUEUE,
      async (job) => {
        if (job.name === "cleanup-invoice-exports") return this.cleanup();
        return this.process(job);
      },
      {
        connection: bullConnection(),
        prefix: bullPrefix(),
        concurrency: exportWorkerConcurrency(),
      },
    );
    this.worker.on("completed", (job) =>
      this.logger.log(JSON.stringify({ event: "invoice_export_completed", jobId: job.id })),
    );
    this.worker.on("failed", (job, error) =>
      this.logger.error(
        JSON.stringify({
          event: "invoice_export_failed",
          jobId: job?.id,
          attempt: job?.attemptsMade,
          message: error.message,
        }),
      ),
    );
    this.worker.on("error", (error) =>
      this.logger.error(
        JSON.stringify({ event: "invoice_export_worker_error", message: error.message }),
      ),
    );
    await this.worker.waitUntilReady();
    this.logger.log(
      JSON.stringify({
        event: "invoice_export_worker_ready",
        concurrency: exportWorkerConcurrency(),
      }),
    );
  }

  private async process(job: Job<InvoiceExportJob>) {
    const { exportId, organizationId } = job.data;
    const record = await this.db.orm.public.InvoiceExport.where({
      id: exportId,
      organizationId,
    }).first();
    if (!record) throw new Error("EXPORT_NOT_FOUND");
    if (record.status === "COMPLETED" && record.archiveKey) return;
    const invoiceIds = this.invoiceIds(record.invoiceIds);
    const archiveKey = this.storage.key(organizationId, exportId);

    const existing = await this.storage.exists(archiveKey, organizationId, exportId);
    if (existing) {
      await this.complete(record.id, organizationId, archiveKey, existing.size);
      return;
    }

    await this.db.orm.public.InvoiceExport.where({
      id: exportId,
      organizationId,
    }).updateAll({ status: "PROCESSING", progress: 0, failureCode: null });

    let bytes = 0;
    const limiter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        bytes += chunk.length;
        if (bytes > MAX_EXPORT_BYTES) callback(new Error("EXPORT_TOO_LARGE"));
        else callback(null, chunk);
      },
    });
    const zip = archiver("zip", { zlib: { level: 6 } });
    zip.on("warning", (error) => limiter.destroy(error));
    zip.on("error", (error) => limiter.destroy(error));
    zip.pipe(limiter);
    const upload = this.storage.put(archiveKey, limiter, organizationId, exportId);

    try {
      for (const [index, invoiceId] of invoiceIds.entries()) {
        const pdf = await this.pdfs.resolve(organizationId, invoiceId);
        zip.append(pdf.buffer, { name: pdf.filename });
        const progress = Math.floor(((index + 1) / invoiceIds.length) * 90);
        await Promise.all([
          job.updateProgress(progress),
          this.db.orm.public.InvoiceExport.where({
            id: exportId,
            organizationId,
          }).updateAll({ progress }),
        ]);
      }
      await zip.finalize();
      await upload;
      await this.complete(record.id, organizationId, archiveKey, bytes);
      await job.updateProgress(100);
    } catch (error) {
      zip.abort();
      limiter.destroy();
      await upload.catch(() => undefined);
      const failureCode =
        error instanceof Error && error.message === "EXPORT_TOO_LARGE"
          ? "EXPORT_TOO_LARGE"
          : "EXPORT_PROCESSING_FAILED";
      const attempts = Number(job.opts.attempts ?? 1);
      const willRetry = job.attemptsMade + 1 < attempts;
      await this.db.orm.public.InvoiceExport.where({
        id: exportId,
        organizationId,
      }).updateAll({
        status: willRetry ? "QUEUED" : "FAILED",
        failureCode: willRetry ? null : failureCode,
      });
      throw error;
    }
  }

  private invoiceIds(value: string) {
    const parsed: unknown = JSON.parse(value);
    if (
      !Array.isArray(parsed) ||
      parsed.length < 1 ||
      parsed.length > 50 ||
      parsed.some((id) => typeof id !== "string")
    )
      throw new Error("INVALID_EXPORT_PAYLOAD");
    return parsed as string[];
  }

  private async complete(
    id: string,
    organizationId: string,
    archiveKey: string,
    archiveSize: number,
  ) {
    await this.db.orm.public.InvoiceExport.where({ id, organizationId }).updateAll({
      status: "COMPLETED",
      progress: 100,
      archiveKey,
      archiveName: `invoice-export-${id}.zip`,
      archiveSize,
      completedAt: Temporal.Now.instant(),
      failureCode: null,
    });
  }

  private async cleanup() {
    const now = Temporal.Now.instant();
    const deleteBefore = now.subtract({ hours: METADATA_RETENTION_DAYS * 24 });
    const records = await this.db.orm.public.InvoiceExport.where((row) =>
      row.status.in(["COMPLETED", "FAILED", "EXPIRED"]),
    ).all();
    for (const record of records) {
      const expired =
        Temporal.Instant.compare(Temporal.Instant.from(record.expiresAt.toString()), now) <= 0;
      if (expired && record.archiveKey) {
        await this.storage.delete(record.archiveKey);
        await this.db.orm.public.InvoiceExport.where({ id: record.id }).updateAll({
          status: "EXPIRED",
          archiveKey: null,
          archiveSize: null,
        });
      }
      const oldMetadata =
        Temporal.Instant.compare(
          Temporal.Instant.from(record.updatedAt.toString()),
          deleteBefore,
        ) <= 0;
      if (oldMetadata && ["FAILED", "EXPIRED"].includes(record.status) && !record.archiveKey)
        await this.db.orm.public.InvoiceExport.where({ id: record.id }).deleteAll();
    }
  }

  async close() {
    await this.worker?.close();
  }
}
