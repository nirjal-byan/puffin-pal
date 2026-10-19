import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database.module.js";
import { InvoicePdfResolverService } from "../invoices/pdf/invoice-pdf-resolver.service.js";
import { InvoicePdfService } from "../invoices/pdf/invoice-pdf.service.js";
import { InvoicePdfStorageService } from "../invoices/pdf/invoice-pdf-storage.service.js";
import { StorageModule } from "../storage/storage.module.js";
import { InvoiceExportProcessor } from "./invoice-export.processor.js";
import { InvoiceExportStorageService } from "./invoice-export-storage.service.js";
import { RecurringInvoiceProcessor } from "../recurring-invoices/recurring-invoice.processor.js";
import { PayrollPayslipProcessor } from "../payroll/payroll-payslip.processor.js";
import { PayrollPayslipStorageService } from "../payroll/payroll-payslip-storage.service.js";
import { PayrollPdfService } from "../payroll/payroll-pdf.service.js";

@Module({
  imports: [DatabaseModule, StorageModule],
  providers: [
    InvoicePdfService,
    InvoicePdfStorageService,
    InvoicePdfResolverService,
    InvoiceExportStorageService,
    InvoiceExportProcessor,
    RecurringInvoiceProcessor,
    PayrollPayslipStorageService,
    PayrollPdfService,
    PayrollPayslipProcessor,
  ],
})
export class WorkerModule {}
