import { Controller, Get, Query, Res } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { RequirePermissions } from "../../common/decorators/auth.decorators.js";
import { FinancialReportExportQueryDto, FinancialReportQueryDto } from "./financial-reports.dto.js";
import { FinancialExportService } from "./financial-export.service.js";
import { FinancialReportsService } from "./financial-reports.service.js";

@ApiTags("financial-reports")
@ApiBearerAuth()
@Controller("financial-reports")
export class FinancialReportsController {
  constructor(
    private readonly reports: FinancialReportsService,
    private readonly exports: FinancialExportService,
  ) {}

  @Get("overview")
  @RequirePermissions("financial-reports:read")
  overview(@Query() query: FinancialReportQueryDto) {
    return this.reports.report(query);
  }

  @Get("revenue")
  @RequirePermissions("financial-reports:read")
  async revenue(@Query() query: FinancialReportQueryDto) {
    const report = await this.reports.report(query);
    return { currency: report.currency, period: report.period, basis: report.basis, ...report.revenue };
  }

  @Get("expenses")
  @RequirePermissions("financial-reports:read")
  async expenses(@Query() query: FinancialReportQueryDto) {
    const report = await this.reports.report(query);
    return { currency: report.currency, period: report.period, basis: report.basis, ...report.expenses };
  }

  @Get("payroll")
  @RequirePermissions("financial-reports:read", "financial-reports:payroll-read")
  async payroll(@Query() query: FinancialReportQueryDto) {
    const report = await this.reports.report(query);
    return { currency: report.currency, period: report.period, basis: report.basis, ...report.payroll };
  }

  @Get("profitability")
  @RequirePermissions("financial-reports:read")
  async profitability(@Query() query: FinancialReportQueryDto) {
    const report = await this.reports.report(query);
    return { currency: report.currency, period: report.period, basis: report.basis, ...report.profitability };
  }

  @Get("receivables")
  @RequirePermissions("financial-reports:read")
  async receivables(@Query() query: FinancialReportQueryDto) {
    const report = await this.reports.report(query);
    return { currency: report.currency, period: report.period, basis: report.basis, ...report.receivables };
  }

  @Get("payables")
  @RequirePermissions("financial-reports:read")
  async payables(@Query() query: FinancialReportQueryDto) {
    const report = await this.reports.report(query);
    return { currency: report.currency, period: report.period, basis: report.basis, ...report.payables };
  }

  @Get("cash-movement")
  @RequirePermissions("financial-reports:read")
  async cashMovement(@Query() query: FinancialReportQueryDto) {
    const report = await this.reports.report(query);
    return { currency: report.currency, period: report.period, basis: report.basis, ...report.cashMovement };
  }

  @Get("export")
  @RequirePermissions("financial-reports:read", "financial-reports:export")
  async export(@Query() query: FinancialReportExportQueryDto, @Res() response: Response) {
    const report = await this.reports.report(query);
    const name = `operational-report-${query.from}-${query.to}`;
    if (query.format === "csv") {
      response.type("text/csv").attachment(`${name}.csv`).send(this.exports.csv(report));
      return;
    }
    response.type("application/pdf").attachment(`${name}.pdf`).send(await this.exports.pdf(report));
  }
}
