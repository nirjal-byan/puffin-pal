import { randomUUID } from "node:crypto";
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Scope,
  UnauthorizedException,
} from "@nestjs/common";
import { REQUEST } from "@nestjs/core";
import { DATABASE } from "../database.module.js";
import type { Database } from "../database/client.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import type { PageDto } from "../tenancy/page.dto.js";
import type { CreateInvoiceDto } from "./dto/create-invoice.dto.js";
import type { UpdateInvoiceDto } from "./dto/update-invoice.dto.js";
import { calculateInvoice } from "./utils/invoice-calculations.js";
import { invoiceDates } from "./utils/invoice-dates.js";
@Injectable({ scope: Scope.REQUEST })
export class InvoicesService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(REQUEST) private readonly request: AuthenticatedRequest,
  ) {}
  private get organizationId() {
    if (!this.request.auth) throw new UnauthorizedException();
    return this.request.auth.organizationId;
  }
  async createInvoice(input: CreateInvoiceDto) {
    const organizationId = this.organizationId;
    const calculated = calculateInvoice(input.items);
    const dates = invoiceDates(input.issueDate, input.dueDate);
    return this.db.transaction(async (tx) => {
      const client = await tx.orm.public.Client.where({
        organizationId,
        id: input.clientId,
      })
        .select("id")
        .first();
      if (!client) throw new NotFoundException("Client not found");
      // UUID-based numbering avoids counters, scans and read/write races. The
      // existing per-organization unique constraint is the final DB safeguard.
      const invoice = await tx.orm.public.Invoice.create({
        organizationId,
        clientId: client.id,
        invoiceNumber: `INV-${randomUUID()}`,
        status: "DRAFT",
        ...dates,
        subtotal: calculated.subtotal,
        tax: calculated.tax,
        total: calculated.total,
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      });
      const items = [];
      for (const [position, item] of calculated.items.entries()) {
        items.push(
          await tx.orm.public.InvoiceItem.create({
            organizationId,
            invoiceId: invoice.id,
            ...item,
            position,
          }),
        );
      }
      return { ...invoice, items };
    });
  }

  async getInvoice(id: string) {
    const organizationId = this.organizationId;
    return this.db.transaction(async (tx) => {
      // A single MVCC snapshot keeps header, client and items consistent with
      // each other even when another user replaces the items concurrently.
      await tx.execute(
        this.db.raw.sql`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ`
          .affectedCount()
          .build(),
      );
      const invoice = await tx.orm.public.Invoice.where({
        organizationId,
        id,
      }).first();
      if (!invoice) throw new NotFoundException("Invoice not found");
      const client = await tx.orm.public.Client.where({
        organizationId,
        id: invoice.clientId,
      })
        .select("id", "name", "email", "companyName", "taxId")
        .first();
      const items = await tx.orm.public.InvoiceItem.where({
        organizationId,
        invoiceId: id,
      })
        .orderBy((row) => row.position.asc())
        .orderBy((row) => row.id.asc())
        .all();
      return { ...invoice, client, items };
    });
  }

  async updateInvoice(id: string, input: UpdateInvoiceDto) {
    const organizationId = this.organizationId;
    const calculated = calculateInvoice(input.items);
    const dates = invoiceDates(input.issueDate, input.dueDate);
    return this.db.transaction(async (tx) => {
      const current = await tx.orm.public.Invoice.where({
        organizationId,
        id,
      }).first();
      if (!current) throw new NotFoundException("Invoice not found");
      if (current.status !== "DRAFT")
        throw new ConflictException("Only DRAFT invoices can be edited");
      const client = await tx.orm.public.Client.where({
        organizationId,
        id: input.clientId,
      })
        .select("id", "name", "email", "companyName", "taxId")
        .first();
      if (!client) throw new NotFoundException("Client not found");
      // PostgreSQL rechecks these predicates after waiting for a competing
      // writer. Only one request with this version can acquire the write.
      const [invoice] = await tx.orm.public.Invoice.where({
        organizationId,
        id,
        status: "DRAFT",
        version: input.expectedVersion,
      }).updateAll({
        clientId: client.id,
        ...dates,
        subtotal: calculated.subtotal,
        tax: calculated.tax,
        total: calculated.total,
        version: input.expectedVersion + 1,
        ...(input.notes !== undefined
          ? { notes: input.notes.trim() || null }
          : {}),
      });
      if (!invoice)
        throw new ConflictException(
          "Invoice changed. Reload and review the latest version before saving.",
        );
      await tx.orm.public.InvoiceItem.where({
        organizationId,
        invoiceId: id,
      }).deleteAll();
      const items = [];
      for (const [position, item] of calculated.items.entries()) {
        items.push(
          await tx.orm.public.InvoiceItem.create({
            organizationId,
            invoiceId: id,
            position,
            ...item,
          }),
        );
      }
      return { ...invoice, client, items };
    });
  }

  async deleteInvoice(id: string, expectedVersion: number) {
    const organizationId = this.organizationId;
    return this.db.transaction(async (tx) => {
      const current = await tx.orm.public.Invoice.where({
        organizationId,
        id,
      }).first();
      if (!current) throw new NotFoundException("Invoice not found");
      if (current.status !== "DRAFT")
        throw new ConflictException("Only DRAFT invoices can be deleted");
      const [deleted] = await tx.orm.public.Invoice.where({
        organizationId,
        id,
        status: "DRAFT",
        version: expectedVersion,
      }).deleteAll();
      if (!deleted)
        throw new ConflictException(
          "Invoice changed. Reload and review the latest version before deleting.",
        );
      // Existing composite FK cascades item deletion in this same transaction.
      return { message: "Draft invoice deleted successfully." };
    });
  }

  listInvoices(page: PageDto) {
    return this.db.orm.public.Invoice.where({
      organizationId: this.organizationId,
    })
      .orderBy((row) => row.id.asc())
      .limit(page.limit)
      .offset(page.offset)
      .all();
  }
  async listInvoiceItems(invoiceId: string, page: PageDto) {
    const invoice = await this.db.orm.public.Invoice.where({
      organizationId: this.organizationId,
      id: invoiceId,
    })
      .select("id")
      .first();
    if (!invoice) throw new NotFoundException("Invoice not found");
    return this.db.orm.public.InvoiceItem.where({
      organizationId: this.organizationId,
      invoiceId,
    })
      .orderBy((row) => row.position.asc())
      .orderBy((row) => row.id.asc())
      .limit(page.limit)
      .offset(page.offset)
      .all();
  }
}
