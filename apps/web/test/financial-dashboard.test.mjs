import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const source = await readFile(
  new URL("../src/features/dashboard/components/financial-dashboard.tsx", import.meta.url),
  "utf8",
);
const filterSource = await readFile(
  new URL("../src/features/dashboard/components/dashboard-period-filter.tsx", import.meta.url),
  "utf8",
);

test("dashboard provides range controls, financial KPIs, and accessible analytics", () => {
  for (const label of [
    "Invoiced revenue",
    "Payments received",
    "Outstanding",
    "Overdue",
    "Expenses",
    "Net cash flow",
  ])
    assert.match(source, new RegExp(label));
  assert.match(filterSource, /type="date"/);
  assert.match(source, /role="img"/);
  assert.match(source, /No financial activity yet/);
  assert.match(source, /Try again/);
});

test("dashboard and reports discard late successes and surface retryable errors", async () => {
  const { createHookHarness, flushPromises } = await import("./helpers/hook-harness.mjs");
  const { useFinancialSummary } = await import("../src/features/dashboard/hooks/use-financial-summary.ts");
  const { useFinancialReport } = await import("../src/features/financial-reports/hooks/use-financial-report.ts");
  for (const kind of ["dashboard", "reports"]) {
    const calls = [];
    const api = (path, options) => new Promise((resolve, reject) => calls.push({ path, options, resolve, reject }));
    const range = { from: "2026-01-01", to: "2026-01-31" };
    let query = "currency=USD";
    const h = createHookHarness(() => kind === "dashboard"
      ? useFinancialSummary(api, range) : useFinancialReport(api, query, true));
    h.render(); await flushPromises();
    range.to = "2026-02-28"; query = "currency=EUR";
    assert.equal(h.render().loading, true);
    await flushPromises();
    assert.equal(calls[0].options.signal.aborted, true);
    const newest = { range: { ...range }, currency: "EUR" };
    calls[1].resolve(newest); await flushPromises();
    calls[0].resolve({ range: { from: "old", to: "old" }, currency: "USD" }); await flushPromises();
    assert.equal((h.render().summary ?? h.render().report).currency, "EUR");
    h.render().reload(); h.render(); await flushPromises();
    calls[2].reject(new Error("Offline")); await flushPromises();
    assert.match(h.render().error, /Offline/);
    h.render().reload(); h.render(); await flushPromises();
    calls[3].resolve(newest); await flushPromises();
    assert.equal(h.render().error, "");
    h.unmount();
  }
});
