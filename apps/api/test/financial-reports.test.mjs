import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { REQUIRED_PERMISSIONS } from "../dist/src/common/decorators/auth.decorators.js";
import { FinancialReportsController } from "../dist/src/modules/financial-reports/financial-reports.controller.js";
import { FinancialReportQueryDto } from "../dist/src/modules/financial-reports/financial-reports.dto.js";
import { FinancialExportService } from "../dist/src/modules/financial-reports/financial-export.service.js";
import { FinancialReportsService } from "../dist/src/modules/financial-reports/financial-reports.service.js";
import { csvCell, validateReportRange } from "../dist/src/modules/financial-reports/financial-report-utils.js";

test("financial report ranges and currency filters are bounded", async () => {
  assert.doesNotThrow(() => validateReportRange("2026-01-01", "2026-12-31"));
  assert.throws(() => validateReportRange("2026-12-31", "2026-01-01"), /from must be on or before to/);
  const errors = await validate(plainToInstance(FinancialReportQueryDto, {
    from: "2026-01-01", to: "2026-12-31", currency: "usd", groupBy: "week",
  }));
  assert.equal(errors.length, 2);
});

test("report endpoints enforce general, payroll, and export permissions", () => {
  assert.deepEqual(Reflect.getMetadata(REQUIRED_PERMISSIONS, FinancialReportsController.prototype.overview), ["financial-reports:read"]);
  assert.deepEqual(Reflect.getMetadata(REQUIRED_PERMISSIONS, FinancialReportsController.prototype.payroll), ["financial-reports:read", "financial-reports:payroll-read"]);
  assert.deepEqual(Reflect.getMetadata(REQUIRED_PERMISSIONS, FinancialReportsController.prototype.export), ["financial-reports:read", "financial-reports:export"]);
});

test("report query binds tenant and currency and returns decimal strings", async () => {
  let plan;
  const payload = {
    currency: "USD", period: { from: "2026-01-01", to: "2026-12-31", groupBy: "month" },
    basis: { name: "Operational Profitability Report", disclosures: [] },
    revenue: { issued: "10.10" }, expenses: {}, payroll: {}, profitability: {}, receivables: {}, payables: {}, cashMovement: {}, trend: [],
  };
  const db = {
    raw: { sql(strings, ...values) { return { returnsRow() { return this; }, build() { return { strings, values }; } }; } },
    runtime() { return { async query(value) { plan = value; return [{ payload: JSON.stringify(payload) }]; } }; },
  };
  const service = new FinancialReportsService(db, { auth: { organizationId: "org-a", userId: "user-a", role: "OWNER" } });
  const result = await service.report({ from: "2026-01-01", to: "2026-12-31", currency: "USD", groupBy: "month" });
  assert.equal(result.revenue.issued, "10.10");
  assert.ok(plan.values.includes("org-a"));
  assert.ok(plan.values.includes("USD"));
  assert.match(plan.strings.join(""), /issuedAt/);
  assert.match(plan.strings.join(""), /FINALIZED/);
  assert.match(plan.strings.join(""), /approvalStatus/);
});

test("CSV exports neutralize spreadsheet formulas and disclose basis", () => {
  assert.equal(csvCell("=SUM(A1:A2)"), '"\'=SUM(A1:A2)"');
  const report = {
    currency: "USD", period: { from: "2026-01-01", to: "2026-01-31", groupBy: "month" },
    basis: { name: "Operational Profitability Report", disclosures: ["Not a formal statement."] },
    revenue: { issued: "1.00", collected: "1.00", outstanding: "0.00" },
    expenses: { approved: "0.00" }, payroll: { gross: "0.00", employerContributions: "0.00" },
    profitability: { profit: "1.00" }, receivables: {}, payables: {}, cashMovement: {},
  };
  const csv = new FinancialExportService().csv(report);
  assert.match(csv, /Operational Profitability Report/);
  assert.match(csv, /Not a formal statement/);
});
