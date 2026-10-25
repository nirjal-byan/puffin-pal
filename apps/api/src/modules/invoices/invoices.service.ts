import { Temporal } from "temporal-polyfill";
import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Scope,
  UnauthorizedException,
} from "@nestjs/common";
import { REQUEST } from "@nestjs/core";
import { DATABASE } from "../../infrastructure/database/database.module.js";
import type { Database } from "../../infrastructure/database/client.js";
import type { AuthenticatedRequest } from "../../common/types/auth.types.js";
import type { PageDto } from "../tenancy/page.dto.js";
import type { CreateInvoiceDto } from "./dto/create-invoice.dto.js";
import type { UpdateInvoiceDto } from "./dto/update-invoice.dto.js";
import { calculateInvoice } from "./utils/invoice-calculations.js";
import { invoiceDates } from "./utils/invoice-dates.js";
import type { CreatePaymentDto } from "./dto/create-payment.dto.js";
import {
  invoicePaymentSummary,
  paymentCents,
  receivedPaymentDate,
} from "./utils/invoice-payments.js";
import { decimalFromCents } from "./utils/invoice-calculations.js";
import { InvoicePdfService } from "./pdf/invoice-pdf.service.js";
import { InvoicePdfStorageService } from "./pdf/invoice-pdf-storage.service.js";
@Injectable({ scope: Scope.REQUEST })
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(REQUEST) private readonly request: AuthenticatedRequest,
    private readonly pdf: InvoicePdfService,
    private readonly pdfStorage: InvoicePdfStorageService,
  ) {}
  private get organizationId() {
    if (!this.request.auth) throw new UnauthorizedException();
    return this.request.auth.organizationId;
  }
  private publicInvoice<T extends { pdfKey?: string | null; pdfUrl?: string | null }>(
    invoice: T,
  ): Omit<T, "pdfKey" | "pdfUrl"> {
    const safe = { ...invoice };
    delete safe.pdfKey;
    delete safe.pdfUrl;
    return safe;
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
      const items: Awaited<ReturnType<typeof tx.orm.public.InvoiceItem.create>>[] = [];
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
      return { ...this.publicInvoice(invoice), items };
    });
  }

  async getInvoice(id: string) {
    const organizationId = this.organizationId;
    return this.db.transaction(async (tx) => {
      // A single MVCC snapshot keeps header, client and items consistent with
      // each other even when another user replaces the items concurrently.
      await tx.execute(
        this.db.raw.sql`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ`.affectedCount().build(),
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
      const billingClient = invoice.issuedAt
        ? {
            ...client,
            id: invoice.clientId,
            name: invoice.billingName!,
            email: invoice.billingEmail!,
            companyName: invoice.billingCompanyName,
            taxId: invoice.billingTaxId,
          }
        : client;
      const payments = await tx.orm.public.Payment.where({ organizationId, invoiceId: id })
        .orderBy((row) => row.paymentDate.desc())
        .orderBy((row) => row.createdAt.desc())
        .orderBy((row) => row.id.asc())
        .all();
      return {
        ...this.publicInvoice(invoice),
        client: billingClient,
        items,
        payments,
        ...invoicePaymentSummary(invoice, payments),
      };
    });
  }

  async issueInvoice(id: string, expectedVersion: number) {
    const organizationId = this.organizationId;
    let stagedPdfKey: string | null = null;
    try {
      return await this.db.transaction(async (tx) => {
        // Lock before reading items: draft edits lock this same parent row before
        // replacing items. The conditional write also guards every transition.
        await tx.execute(
          this.db.raw.sql`
        SELECT id FROM invoices
        WHERE id = ${id} AND "organizationId" = ${organizationId}
        FOR UPDATE
      `
            .affectedCount()
            .build(),
        );
        const current = await tx.orm.public.Invoice.where({
          organizationId,
          id,
        }).first();
        if (!current) throw new NotFoundException("Invoice not found");
        if (current.status !== "DRAFT" || current.version !== expectedVersion)
          throw new ConflictException(
            "Invoice changed or is already finalized. Reload and review the latest invoice.",
          );
        // Shared locks ensure billing snapshots cannot change during issuance.
        await tx.execute(
          this.db.raw.sql`
        SELECT id FROM organizations WHERE id = ${organizationId} FOR SHARE
      `
            .affectedCount()
            .build(),
        );
        await tx.execute(
          this.db.raw.sql`
        SELECT id FROM clients WHERE id = ${current.clientId}
        AND "organizationId" = ${organizationId} FOR SHARE
      `
            .affectedCount()
            .build(),
        );
        const organization = await tx.orm.public.Organization.where({
          id: organizationId,
        }).first();
        const client = await tx.orm.public.Client.where({
          organizationId,
          id: current.clientId,
        }).first();
        if (!client || !organization)
          throw new BadRequestException("Invoice billing details are unavailable");
        if (
          !client.name.trim() ||
          !client.email.trim() ||
          !organization.name.trim() ||
          !organization.currency.trim() ||
          !current.invoiceNumber.trim()
        )
          throw new BadRequestException("Complete the invoice billing details before issuance");
        invoiceDates(current.issueDate.toString(), current.dueDate.toString());
        const items = await tx.orm.public.InvoiceItem.where({
          organizationId,
          invoiceId: id,
        })
          .orderBy((row) => row.position.asc())
          .orderBy((row) => row.id.asc())
          .all();
        const calculated = calculateInvoice(items);
        if (
          calculated.subtotal !== current.subtotal ||
          calculated.tax !== current.tax ||
          calculated.total !== current.total ||
          items.some((item, index) => item.amount !== calculated.items[index]!.amount)
        )
          throw new BadRequestException(
            "Invoice amounts are inconsistent. Review and save the draft before issuance.",
          );
        const issuedAt = Temporal.Now.instant();
        const snapshots = {
          billingName: client.name,
          billingEmail: client.email,
          billingCompanyName: client.companyName,
          billingTaxId: client.taxId,
          sellerName: organization.name,
          currency: organization.currency,
        };
        const pdf = await this.pdf.render({
          ...current,
          ...snapshots,
          status: "ISSUED",
          issuedAt,
          items,
        });
        stagedPdfKey = this.pdfStorage.createKey(organizationId, id);
        await this.pdfStorage.put(stagedPdfKey, pdf, organizationId, id);
        const [invoice] = await tx.orm.public.Invoice.where({
          organizationId,
          id,
          status: "DRAFT",
          version: expectedVersion,
        }).updateAll({
          status: "ISSUED",
          version: expectedVersion + 1,
          issuedAt,
          issuedByUserId: this.request.auth!.userId,
          ...snapshots,
          pdfKey: stagedPdfKey,
        });
        if (!invoice)
          throw new ConflictException("Invoice changed. Reload and review the latest invoice.");
        return {
          ...this.publicInvoice(invoice),
          client,
          items,
          payments: [],
          ...invoicePaymentSummary(invoice, []),
        };
      });
    } catch (error) {
      if (stagedPdfKey) {
        try {
          await this.pdfStorage.delete(stagedPdfKey);
        } catch (cleanupError) {
          this.logger.error(
            `Failed to clean up staged invoice PDF ${stagedPdfKey}`,
            cleanupError instanceof Error ? cleanupError.stack : undefined,
          );
        }
      }
      throw error;
    }
  }

  async getInvoicePdf(id: string) {
    const organizationId = this.organizationId;
    const stored = await this.db.orm.public.Invoice.where({
      organizationId,
      id,
    })
      .select("pdfKey")
      .first();
    if (!stored) throw new NotFoundException("Invoice not found");
    const invoice = await this.getInvoice(id);
    if (stored.pdfKey)
      return {
        invoice,
        buffer: await this.pdfStorage.get(stored.pdfKey, organizationId, id),
        stored: true,
      };
    return {
      invoice,
      buffer: await this.pdf.render(invoice),
      stored: false,
    };
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
        ...(input.notes !== undefined ? { notes: input.notes.trim() || null } : {}),
      });
      if (!invoice)
        throw new ConflictException(
          "Invoice changed. Reload and review the latest version before saving.",
        );
      await tx.orm.public.InvoiceItem.where({
        organizationId,
        invoiceId: id,
      }).deleteAll();
      const items: Awaited<ReturnType<typeof tx.orm.public.InvoiceItem.create>>[] = [];
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
      return { ...this.publicInvoice(invoice), client, items };
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

  async recordPayment(id: string, input: CreatePaymentDto) {
    const organizationId = this.organizationId;
    const amount = paymentCents(input.amount);
    if (amount <= 0n) throw new BadRequestException("Payment amount must be greater than zero");
    const paymentDate = receivedPaymentDate(input.paymentDate);
    await this.db.transaction(async (tx) => {
      // Serialize payment writers on the invoice before reading the ledger.
      await tx.execute(
        this.db.raw.sql`
        SELECT id FROM invoices WHERE id = ${id} AND "organizationId" = ${organizationId} FOR UPDATE
      `
          .affectedCount()
          .build(),
      );
      const invoice = await tx.orm.public.Invoice.where({ organizationId, id }).first();
      if (!invoice) throw new NotFoundException("Invoice not found");
      if (!invoice.issuedAt || !["ISSUED", "OVERDUE"].includes(invoice.status))
        throw new ConflictException(
          "Payments can only be recorded against issued invoices with a balance",
        );
      if (invoice.version !== input.expectedVersion)
        throw new ConflictException(
          "Invoice changed. Reload and review its payment history before retrying.",
        );
      const payments = await tx.orm.public.Payment.where({ organizationId, invoiceId: id })
        .select("amount")
        .all();
      const summary = invoicePaymentSummary(invoice, payments);
      const balance = paymentCents(summary.outstandingBalance);
      if (amount > balance)
        throw new ConflictException("Payment exceeds the outstanding invoice balance");
      await tx.orm.public.Payment.create({
        organizationId,
        invoiceId: id,
        amount: decimalFromCents(amount),
        paymentDate,
        method: input.method,
        reference: input.reference?.trim() || null,
        notes: input.notes?.trim() || null,
        recordedByUserId: this.request.auth!.userId,
      });
      const [updated] = await tx.orm.public.Invoice.where({
        organizationId,
        id,
        version: input.expectedVersion,
      }).updateAll({
        status: amount === balance ? "PAID" : "ISSUED",
        version: input.expectedVersion + 1,
      });
      if (!updated) throw new ConflictException("Invoice changed. Reload before retrying.");
    });
    return this.getInvoice(id);
  }

  async listInvoices(page: PageDto) {
    const organizationId = this.organizationId;
    return this.db.transaction(async (tx) => {
      await tx.execute(
        this.db.raw.sql`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ`.affectedCount().build(),
      );
      const invoices = await tx.orm.public.Invoice.where({ organizationId })
        .orderBy((row) => row.id.asc())
        .limit(page.limit)
        .offset(page.offset)
        .all();
      if (!invoices.length) return [];
      const payments = await tx.orm.public.Payment.where({ organizationId })
        .where((row) => row.invoiceId.in(invoices.map((invoice) => invoice.id)))
        .select("invoiceId", "amount")
        .all();
      return invoices.map((invoice) => ({
        ...this.publicInvoice(invoice),
        ...invoicePaymentSummary(
          invoice,
          payments.filter((payment) => payment.invoiceId === invoice.id),
        ),
      }));
    });
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
