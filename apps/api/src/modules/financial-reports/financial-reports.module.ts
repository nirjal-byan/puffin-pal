import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { FinancialReportsController } from "./financial-reports.controller.js";
import { FinancialExportService } from "./financial-export.service.js";
import { FinancialReportsService } from "./financial-reports.service.js";

@Module({
  imports: [AuthModule],
  controllers: [FinancialReportsController],
  providers: [FinancialReportsService, FinancialExportService],
})
export class FinancialReportsModule {}
