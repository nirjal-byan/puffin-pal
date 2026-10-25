import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { DATABASE } from "../../../infrastructure/database/database.module.js";
import type { Database } from "../../../infrastructure/database/client.js";
import { InvoicePdfService, invoicePdfFilename } from "./invoice-pdf.service.js";
import { InvoicePdfStorageService } from "./invoice-pdf-storage.service.js";

@Injectable()
export class InvoicePdfResolverService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly renderer: InvoicePdfService,
    private readonly storage: InvoicePdfStorageService,
  ) {}

  async resolve(organizationId: string, invoiceId: string) {
    const invoice = await this.db.orm.public.Invoice.where({
      organizationId,
      id: invoiceId,
    }).first();
    if (!invoice || !invoice.issuedAt || !["ISSUED", "PAID", "OVERDUE"].includes(invoice.status))
      throw new NotFoundException("Eligible invoice not found");
    const items = await this.db.orm.public.InvoiceItem.where({
      organizationId,
      invoiceId,
    })
      .orderBy((row) => row.position.asc())
      .orderBy((row) => row.id.asc())
      .all();
    const buffer = invoice.pdfKey
      ? await this.storage.get(invoice.pdfKey, organizationId, invoiceId)
      : await this.renderer.render({ ...invoice, items });
    return {
      buffer,
      filename: invoicePdfFilename(invoice.invoiceNumber),
      source: invoice.pdfKey ? ("STORED" as const) : ("HISTORICAL" as const),
    };
  }
}
