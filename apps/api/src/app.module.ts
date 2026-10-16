import { InvoicesModule } from "./invoices/invoices.module.js";
import { Module } from "@nestjs/common";
import { DatabaseModule } from "./database.module.js";
import { HealthController } from "./health.controller.js";
import { AuthModule } from "./auth/auth.module.js";
import { TenancyModule } from "./tenancy/tenancy.module.js";
import { ExpensesModule } from "./expenses/expenses.module.js";
import { StorageModule } from "./storage/storage.module.js";
import { BackgroundJobsModule } from "./background-jobs/background-jobs.module.js";
@Module({
  imports: [DatabaseModule, StorageModule, AuthModule, TenancyModule, InvoicesModule, ExpensesModule, BackgroundJobsModule],
  controllers: [HealthController],
})
export class AppModule {}
