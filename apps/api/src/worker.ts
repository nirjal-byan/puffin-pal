import "reflect-metadata";
import { config } from "dotenv";
import { NestFactory } from "@nestjs/core";
import { InvoiceExportProcessor } from "./infrastructure/background-jobs/invoice-export.processor.js";
import { WorkerModule } from "./infrastructure/background-jobs/worker.module.js";
import { RecurringInvoiceProcessor } from "./modules/recurring-invoices/recurring-invoice.processor.js";
import { PayrollPayslipProcessor } from "./modules/payroll/payroll-payslip.processor.js";
import { PayrollAutomationProcessor } from "./modules/payroll/payroll-automation.processor.js";

async function bootstrap() {
  config({ quiet: true });
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const app = await NestFactory.createApplicationContext(WorkerModule);
  const processor = app.get(InvoiceExportProcessor);
  const recurring = app.get(RecurringInvoiceProcessor);
  const payroll = app.get(PayrollPayslipProcessor);
  const payrollAutomation = app.get(PayrollAutomationProcessor);
  await Promise.all([
    processor.start(),
    recurring.start(),
    payroll.start(),
    payrollAutomation.start(),
  ]);
  const shutdown = async () => {
    await processor.close();
    await recurring.close();
    await payroll.close();
    await payrollAutomation.close();
    await app.close();
  };
  process.once("SIGTERM", () => void shutdown());
  process.once("SIGINT", () => void shutdown());
}

bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
