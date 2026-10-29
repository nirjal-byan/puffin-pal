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
