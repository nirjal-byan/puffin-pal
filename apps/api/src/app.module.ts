import { InvoicesModule } from "./modules/invoices/invoices.module.js";
import { Module } from "@nestjs/common";
import { DatabaseModule } from "./infrastructure/database/database.module.js";
import { HealthController } from "./health.controller.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { TenancyModule } from "./modules/tenancy/tenancy.module.js";
import { ExpensesModule } from "./modules/expenses/expenses.module.js";
import { StorageModule } from "./infrastructure/storage/storage.module.js";
import { BackgroundJobsModule } from "./infrastructure/background-jobs/background-jobs.module.js";
import { DashboardModule } from "./modules/dashboard/dashboard.module.js";
import { RecurringInvoicesModule } from "./modules/recurring-invoices/recurring-invoices.module.js";
import { EmployeesModule } from "./modules/employees/employees.module.js";
import { PayrollModule } from "./modules/payroll/payroll.module.js";
import { WorkforceModule } from "./modules/workforce/workforce.module.js";
import { CashFlowModule } from "./modules/cash-flow/cash-flow.module.js";
import { BankingModule } from "./modules/banking/banking.module.js";
import { FinancialReportsModule } from "./modules/financial-reports/financial-reports.module.js";
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
    BankingModule,
    FinancialReportsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
