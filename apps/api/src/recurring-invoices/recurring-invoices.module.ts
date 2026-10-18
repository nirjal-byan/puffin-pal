import { Module } from "@nestjs/common";
import { StorageModule } from "../storage/storage.module.js";
import { InvoicePdfService } from "../invoices/pdf/invoice-pdf.service.js";
import { InvoicePdfStorageService } from "../invoices/pdf/invoice-pdf-storage.service.js";
import { RecurringInvoicesController } from "./recurring-invoices.controller.js";
import { RecurringInvoicesService } from "./recurring-invoices.service.js";
import { RecurringInvoiceQueue } from "./recurring-invoice.queue.js";

@Module({
  imports: [StorageModule],
  controllers: [RecurringInvoicesController],
  providers: [
    RecurringInvoicesService,
    RecurringInvoiceQueue,
    InvoicePdfService,
    InvoicePdfStorageService,
  ],
  exports: [RecurringInvoiceQueue],
})
export class RecurringInvoicesModule {}
