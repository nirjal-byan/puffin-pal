import { Module } from "@nestjs/common";
import { StorageModule } from "../storage/storage.module.js";
import { PayrollController } from "./payroll.controller.js";
import { PayrollService } from "./payroll.service.js";
import { PayrollPayslipQueue } from "./payroll-payslip.queue.js";
import { PayrollPayslipStorageService } from "./payroll-payslip-storage.service.js";
import { PayrollPdfService } from "./payroll-pdf.service.js";
import { PayrollAutomationQueue } from "./payroll-automation.queue.js";
import { PayrollNotificationsService } from "./payroll-notifications.service.js";
import { PayrollSchedulesController } from "./payroll-schedules.controller.js";
import { PayrollSchedulesService } from "./payroll-schedules.service.js";
import { PayrollNotificationsController } from "./payroll-notifications.controller.js";
import { PayrollStatutoryController } from "./payroll-statutory.controller.js";
import { PayrollStatutoryService } from "./payroll-statutory.service.js";

@Module({
  imports: [StorageModule],
  controllers: [
    PayrollController,
    PayrollSchedulesController,
    PayrollNotificationsController,
    PayrollStatutoryController,
  ],
  providers: [
    PayrollService,
    PayrollSchedulesService,
    PayrollAutomationQueue,
    PayrollNotificationsService,
    PayrollPayslipQueue,
    PayrollPayslipStorageService,
    PayrollPdfService,
    PayrollStatutoryService,
  ],
  exports: [PayrollPayslipQueue, PayrollAutomationQueue],
})
export class PayrollModule {}
