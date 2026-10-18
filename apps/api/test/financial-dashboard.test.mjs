import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { REQUIRED_PERMISSIONS } from "../dist/src/auth/auth.decorators.js";
import { FinancialSummaryController } from "../dist/src/dashboard/financial-summary.controller.js";
import { FinancialSummaryQueryDto } from "../dist/src/dashboard/financial-summary.dto.js";
import { FinancialSummaryService, reportingRange } from "../dist/src/dashboard/financial-summary.service.js";

test("dashboard reporting ranges validate and choose bounded granularity", async () => {
  assert.equal(reportingRange("2026-10-01", "2026-10-16").granularity, "day");
  assert.equal(reportingRange("2026-01-01", "2026-04-01").granularity, "week");
  assert.equal(reportingRange("2025-01-01", "2026-10-16").granularity, "month");
  assert.throws(() => reportingRange("2026-10-16", "2026-10-01"), /from must be on or before to/);
  const errors = await validate(plainToInstance(FinancialSummaryQueryDto, { from: "10/01/2026", to: "2026-10-16", organizationId: "other" }), { whitelist: true, forbidNonWhitelisted: true });
  assert.ok(errors.length >= 2);
});

test("dashboard endpoint requires both financial read permissions", () => {
  const permissions = Reflect.getMetadata(REQUIRED_PERMISSIONS, FinancialSummaryController.prototype.get);
  assert.deepEqual(permissions, ["invoices:read", "expenses:read"]);
});

test("financial summary binds the authenticated tenant and preserves decimal strings", async () => {
  let plan;
  const payload = {
    currency: "USD",
    range: { from: "2026-10-01", to: "2026-10-16", granularity: "day" },
    metrics: { invoicedRevenue: "10.10", paymentsReceived: "0.10", outstandingBalance: "10.00", overdueBalance: "0.00", expenses: "0.20", netCashFlow: "-0.10" },
    trend: [], invoiceStatuses: [], expenseCategories: [], aging: [],
  };
  const db = {
    raw: { sql(strings, ...values) { return { returnsRow() { return this; }, build() { return { strings, values }; } }; } },
    runtime() { return { async query(value) { plan = value; return [{ payload: JSON.stringify(payload) }]; } }; },
  };
  const service = new FinancialSummaryService(db, { auth: { organizationId: "org-a", userId: "user-a" } });
  const result = await service.get({ from: "2026-10-01", to: "2026-10-16" });
  assert.deepEqual(result, payload);
  assert.ok(plan.values.includes("org-a"));
  assert.equal(plan.values.includes("org-b"), false);
  assert.equal(result.metrics.invoicedRevenue, "10.10");
  assert.match(plan.strings.join(""), /approvalStatus/);
  assert.match(plan.strings.join(""), /APPROVED/);
});
