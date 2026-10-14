import { InvoicesModule } from "./invoices/invoices.module.js";
import { Module } from "@nestjs/common";
import { DatabaseModule } from "./database.module.js";
import { HealthController } from "./health.controller.js";
import { AuthModule } from "./auth/auth.module.js";
import { TenancyModule } from "./tenancy/tenancy.module.js";
import { ExpensesModule } from "./expenses/expenses.module.js";
@Module({
  imports: [DatabaseModule, AuthModule, TenancyModule, InvoicesModule, ExpensesModule],
  controllers: [HealthController],
})
export class AppModule {}
