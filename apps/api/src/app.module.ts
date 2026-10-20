import { InvoicesModule } from "./invoices/invoices.module.js";
import { Module } from "@nestjs/common";
import { DatabaseModule } from "./database.module.js";
import { HealthController } from "./health.controller.js";
import { AuthModule } from "./auth/auth.module.js";
import { TenancyModule } from "./tenancy/tenancy.module.js";
import { ExpensesModule } from "./expenses/expenses.module.js";
import { StorageModule } from "./storage/storage.module.js";
import { BackgroundJobsModule } from "./background-jobs/background-jobs.module.js";
import { DashboardModule } from "./dashboard/dashboard.module.js";
import { RecurringInvoicesModule } from "./recurring-invoices/recurring-invoices.module.js";
import { EmployeesModule } from "./employees/employees.module.js";
import { PayrollModule } from "./payroll/payroll.module.js";
import { WorkforceModule } from "./workforce/workforce.module.js";
import { CashFlowModule } from "./cash-flow/cash-flow.module.js";
@Module({
  imports: [
    DatabaseModule,
    StorageModule,
    AuthModule,
    TenancyModule,
    InvoicesModule,
    ExpensesModule,
    BackgroundJobsModule,
    DashboardModule,
    RecurringInvoicesModule,
    EmployeesModule,
    PayrollModule,
    WorkforceModule,
    CashFlowModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
