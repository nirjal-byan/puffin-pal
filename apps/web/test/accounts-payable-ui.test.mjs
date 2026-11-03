import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import swc from "next/dist/build/swc/index.js";

// Use the installed Next.js TypeScript/JSX compiler; no additional test dependency.
const source = fileURLToPath(new URL("../src/", import.meta.url));
registerHooks({
  resolve(specifier, context, nextResolve) {
    const base = specifier.startsWith("@/")
      ? join(source, specifier.slice(2))
      : specifier.startsWith(".") && context.parentURL?.startsWith("file:")
        ? join(dirname(fileURLToPath(context.parentURL)), specifier)
        : null;
    if (base) {
      const path = [base, `${base}.ts`, `${base}.tsx`].find(existsSync);
      if (path) return { shortCircuit: true, url: pathToFileURL(path).href };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith("file:") && url.endsWith(".tsx")) {
      return {
        shortCircuit: true,
        format: "module",
        source: swc.transformSync(readFileSync(fileURLToPath(url), "utf8"), {
          filename: fileURLToPath(url),
          jsc: {
            parser: { syntax: "typescript", tsx: true },
            transform: { react: { runtime: "automatic" } },
            target: "es2022",
          },
          module: { type: "es6" },
        }).code,
      };
    }
    return nextLoad(url, context);
  },
});
const { BillPaymentsTable } =
  await import("../src/features/accounts-payable/components/bill-payments-table.tsx");
const { BillTransitionDialog } =
  await import("../src/features/accounts-payable/dialogs/bill-transition-dialog.tsx");
const payment = {
  id: "p1",
  vendorBillId: "b1",
  targetType: "VENDOR_BILL",
  amount: "125.50",
  currency: "USD",
  paymentDate: "2026-11-02T00:00:00Z",
  method: "BANK_TRANSFER",
  reference: "REF-123",
  notes: "Initial payment",
  recordedById: "user-1",
  createdAt: "2026-11-02T00:00:00Z",
  reversedAt: null,
  version: 1,
};
const renderPayments = (payments, permissions = ["accounts-payable:pay"], busy = false) =>
  renderToStaticMarkup(
    createElement(BillPaymentsTable, { payments, permissions, busy, onReverse() {} }),
  );

test("payment history renders multiple records, formatted amounts, references and reversal audit", () => {
  const html = renderPayments([
    payment,
    {
      ...payment,
      id: "p2",
      reference: "REF-456",
      reversedAt: "2026-11-03T00:00:00Z",
      reversedById: "approver",
      reversalReason: "Duplicate payment",
    },
  ]);
  for (const text of [
    "Bill payment history",
    "$125.50",
    "2026-11-02",
    "BANK TRANSFER",
    "REF-123",
    "REF-456",
    "Recorded",
    "Reversed",
    "Duplicate payment",
    "approver",
  ])
    assert.ok(html.includes(text), text);
  assert.equal((html.match(/Reverse payment/g) ?? []).length, 1);
  assert.ok(html.includes("Initial payment"));
});

test("readers and reversed payments do not expose reversal actions; busy controls disable submissions", () => {
  assert.ok(!renderPayments([payment], []).includes("Reverse payment"));
  assert.ok(
    !renderPayments([{ ...payment, reversedAt: "2026-11-03" }]).includes("Reverse payment"),
  );
  assert.match(renderPayments([payment], ["accounts-payable:pay"], true), /disabled=""/);
});

test("empty bill history has a clear empty state", () => {
  assert.match(renderPayments([]), /No payments recorded for this bill/);
});

test("rejection dialog requires a reason and an explicit confirmation button", () => {
  const html = renderToStaticMarkup(
    createElement(BillTransitionDialog, {
      bill: { id: "b1", billNumber: "B-01", status: "PENDING_APPROVAL", version: 3 },
      transition: "reject",
      api: () => assert.fail("render must not mutate"),
      permissions: ["accounts-payable:approve"],
      onClose() {},
      async onSaved() {},
    }),
  );
  assert.match(html, /Reject bill\?/);
  assert.match(html, /Rejection reason/);
  assert.match(html, /textarea required="" maxLength="500"/);
  assert.match(html, /disabled=""/);
  assert.match(html, /Cancel/);
});
