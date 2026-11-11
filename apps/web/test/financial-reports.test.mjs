import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const source = await readFile(
  new URL(
    "../src/features/financial-reports/components/financial-reports-page.tsx",
    import.meta.url,
  ),
  "utf8",
);

test("financial reports expose clear operational metrics and exports", () => {
  for (const label of [
    "Issued revenue",
    "Collected",
    "Operating costs",
    "Operational profit",
    "Receivables aging",
    "Cash movement",
  ])
    assert.match(source, new RegExp(label));
  assert.match(source, /Export CSV/);
  assert.match(source, /Export PDF/);
  assert.match(source, /no currency conversion/i);
  assert.match(source, /Forecasts.*excluded/);
});

test("report calendar ranges use consistent UTC days and reject invalid intervals", async () => {
  const { reportPresetRange, validReportingRange } = await import("../src/features/financial-reports/utils.ts");
  assert.deepEqual(reportPresetRange("month", new Date("2026-11-01T00:15:00Z")), { from: "2026-11-01", to: "2026-11-01" });
  assert.deepEqual(reportPresetRange("previous-month", new Date("2026-01-01T00:15:00Z")), { from: "2025-12-01", to: "2025-12-31" });
  assert.equal(validReportingRange("2026-02-30", "2026-03-10"), false);
  assert.equal(validReportingRange("2026-03-10", "2026-03-01"), false);
  assert.equal(validReportingRange("2020-01-01", "2026-03-01"), false);
  assert.equal(validReportingRange("2026-03-01", "2026-03-01"), true);
});
