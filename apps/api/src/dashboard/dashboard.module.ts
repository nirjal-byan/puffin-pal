import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { FinancialSummaryController } from "./financial-summary.controller.js";
import { FinancialSummaryService } from "./financial-summary.service.js";

@Module({
  imports: [AuthModule],
  controllers: [FinancialSummaryController],
  providers: [FinancialSummaryService],
})
export class DashboardModule {}
