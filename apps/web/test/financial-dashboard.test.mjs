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

test("dashboard provides range controls, six KPIs, and accessible analytics", () => {
  for (const label of ["Invoiced revenue", "Payments received", "Outstanding", "Overdue", "Expenses", "Net cash flow"])
    assert.match(source, new RegExp(label));
  assert.match(filterSource, /type="date"/);
  assert.match(source, /role="img"/);
  assert.match(source, /No financial activity yet/);
  assert.match(source, /Try again/);
});
