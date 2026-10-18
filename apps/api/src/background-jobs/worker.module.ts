import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database.module.js";
import { InvoicePdfResolverService } from "../invoices/pdf/invoice-pdf-resolver.service.js";
import { InvoicePdfService } from "../invoices/pdf/invoice-pdf.service.js";
import { InvoicePdfStorageService } from "../invoices/pdf/invoice-pdf-storage.service.js";
import { StorageModule } from "../storage/storage.module.js";
import { InvoiceExportProcessor } from "./invoice-export.processor.js";
import { InvoiceExportStorageService } from "./invoice-export-storage.service.js";
import { RecurringInvoiceProcessor } from "../recurring-invoices/recurring-invoice.processor.js";

@Module({
  imports: [DatabaseModule, StorageModule],
  providers: [
    InvoicePdfService,
    InvoicePdfStorageService,
    InvoicePdfResolverService,
    InvoiceExportStorageService,
    InvoiceExportProcessor,
    RecurringInvoiceProcessor,
  ],
})
export class WorkerModule {}
