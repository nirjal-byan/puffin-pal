import { Module } from "@nestjs/common";
import { StorageModule } from "../storage/storage.module.js";
import { PayrollController } from "./payroll.controller.js";
import { PayrollService } from "./payroll.service.js";
import { PayrollPayslipQueue } from "./payroll-payslip.queue.js";
import { PayrollPayslipStorageService } from "./payroll-payslip-storage.service.js";
import { PayrollPdfService } from "./payroll-pdf.service.js";

@Module({
  imports: [StorageModule],
  controllers: [PayrollController],
  providers: [PayrollService, PayrollPayslipQueue, PayrollPayslipStorageService, PayrollPdfService],
  exports: [PayrollPayslipQueue],
})
export class PayrollModule {}
