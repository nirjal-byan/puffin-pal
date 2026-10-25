import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module.js";
import { InvoicePdfResolverService } from "../../modules/invoices/pdf/invoice-pdf-resolver.service.js";
import { InvoicePdfService } from "../../modules/invoices/pdf/invoice-pdf.service.js";
import { InvoicePdfStorageService } from "../../modules/invoices/pdf/invoice-pdf-storage.service.js";
import { StorageModule } from "../storage/storage.module.js";
import { InvoiceExportProcessor } from "./invoice-export.processor.js";
import { InvoiceExportStorageService } from "./invoice-export-storage.service.js";
import { RecurringInvoiceProcessor } from "../../modules/recurring-invoices/recurring-invoice.processor.js";
import { PayrollPayslipProcessor } from "../../modules/payroll/payroll-payslip.processor.js";
import { PayrollPayslipStorageService } from "../../modules/payroll/payroll-payslip-storage.service.js";
import { PayrollPdfService } from "../../modules/payroll/payroll-pdf.service.js";
import { PayrollAutomationProcessor } from "../../modules/payroll/payroll-automation.processor.js";
import { PayrollNotificationsService } from "../../modules/payroll/payroll-notifications.service.js";
import { PayrollPayslipQueue } from "../../modules/payroll/payroll-payslip.queue.js";

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
    PayrollPayslipQueue,
    PayrollNotificationsService,
    PayrollAutomationProcessor,
  ],
})
export class WorkerModule {}
