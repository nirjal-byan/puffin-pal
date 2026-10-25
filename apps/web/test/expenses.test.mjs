import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { validateExpense, validateReceiptFile } from "../src/features/expenses/schemas/expense.schema.ts";

test("expense form validates exact positive amounts and dates", () => {
  assert.equal(validateExpense({ title: "Hosting", amount: "12.34", date: "2026-10-14" }), "");
  for (const change of [{ title: "" }, { amount: "0" }, { amount: "-1" }, { amount: "1.001" }, { date: "not-a-date" }])
    assert.ok(validateExpense({ title: "Hosting", amount: "12.34", date: "2026-10-14", ...change }));
});
test("receipt picker accepts supported bounded files", () => {
  assert.equal(validateReceiptFile({ type: "application/pdf", size: 1024 }), "");
  assert.equal(validateReceiptFile({ type: "image/webp", size: 5 * 1024 * 1024 }), "");
  assert.ok(validateReceiptFile({ type: "text/plain", size: 10 }));
  assert.ok(validateReceiptFile({ type: "image/png", size: 5 * 1024 * 1024 + 1 }));
});
test("expense UI exposes permission-aware approval controls and history", async () => {
  const source = await readFile(
    new URL("../src/features/expenses/components/expenses-page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /expenses:submit/);
  assert.match(source, /expenses:approve/);
  assert.match(source, /Submit expense/);
  assert.match(source, /Approve expense/);
  assert.match(source, /Rejection reason/);
  assert.match(source, /Approval history/);
});
