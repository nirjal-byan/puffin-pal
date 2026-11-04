import assert from "node:assert/strict";
import { test } from "node:test";
import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import swc from "next/dist/build/swc/index.js";
import "react/jsx-runtime";
import { createHookHarness, flushPromises } from "./helpers/hook-harness.mjs";
import {
  billHref,
  expenseHref,
  canSettleExpense,
  settleExpense,
  reverseExpensePayment,
  validateSettlement,
} from "../src/features/expenses/services/settlement-api.ts";
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/components/ui/date-picker" || specifier === "@/components/ui/dropdown") {
      const name = specifier.endsWith("date-picker") ? "DatePicker" : "Dropdown";
      return {
        shortCircuit: true,
        url: `data:text/javascript,export function ${name}() { return null; }`,
      };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith("file:") && url.endsWith(".tsx"))
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
    return nextLoad(url, context);
  },
});
const { ExpenseSettlementDialog } =
  await import("../src/features/expenses/components/expense-settlement-dialog.tsx");
const { LinkedExpense } =
  await import("../src/features/accounts-payable/components/linked-expense.tsx");
const pay = ["expenses:pay"];
const settlement = {
  expenseId: "e1",
  approvalStatus: "APPROVED",
  linked: false,
  linkedBill: null,
  basis: "EXPENSE",
  expenseAmount: "0.30",
  expenseCurrency: "USD",
  currency: "USD",
  totalAmount: "0.30",
  paidAmount: "0.00",
  balance: "0.30",
  settlementStatus: "UNPAID",
  payments: [],
};
const input = { amount: "0.10", paymentDate: "2026-11-04", method: "CASH", reference: "REF-1" };
const payment = {
  id: "p1",
  targetType: "EXPENSE",
  expenseId: "e1",
  vendorBillId: null,
  amount: "0.10",
  currency: "USD",
  paymentDate: "2026-11-04",
  reversedAt: null,
  version: 2,
};
function find(node, predicate) {
  if (!node || typeof node !== "object") return undefined;
  if (predicate(node)) return node;
  for (const child of [node.props?.children].flat(Infinity)) {
    const value = find(child, predicate);
    if (value) return value;
  }
}
const button = (node, text) =>
  find(node, (element) => element.type === "button" && element.props.children === text);

test("navigation links target the correct feature and escape record IDs", () => {
  assert.equal(billHref("bill-1"), "/?section=accounts-payable&area=finance&bill=bill-1");
  assert.equal(expenseHref("e&1"), "/?section=expenses&area=workspace&expense=e%261");
});

test("only approved standalone expenses expose direct settlement; linked bills cannot be double-paid", () => {
  for (const change of [
    { linked: true },
    { approvalStatus: "DRAFT" },
    { approvalStatus: "REJECTED" },
    { approvalStatus: "PENDING_APPROVAL" },
    { settlementStatus: "PAID" },
  ]) {
    assert.equal(canSettleExpense({ ...settlement, ...change }, pay), false);
    assert.throws(() =>
      settleExpense(
        () => assert.fail("must not mutate"),
        { ...settlement, ...change },
        input,
        pay,
        "key-001",
      ),
    );
  }
  assert.equal(canSettleExpense(settlement, []), false);
  assert.equal(canSettleExpense(settlement, pay), true);
});

test("amount/date validation preserves decimal precision and rejects overpayment or invalid input", () => {
  for (const amount of ["-1", "0", "0.001", "NaN", "1e2", "0.31", ""])
    assert.ok(validateSettlement({ ...input, amount }, "0.30"));
  assert.equal(validateSettlement({ ...input, amount: "0.30" }, "0.30"), "");
  assert.equal(validateSettlement({ ...input, amount: "9999999999.98" }, "9999999999.99"), "");
  assert.ok(validateSettlement({ ...input, paymentDate: "2026-02-30" }, "0.30"));
});

test("payment and reversal payloads reuse existing endpoints and exact amounts/versions", async () => {
  const calls = [];
  const api = async (...args) => {
    calls.push(args);
  };
  await settleExpense(api, settlement, input, pay, "stable-key");
  await reverseExpensePayment(api, settlement, payment, " Correct entry ", pay);
  assert.deepEqual(calls, [
    ["/expenses/e1/payments", { method: "POST", body: { ...input, idempotencyKey: "stable-key" } }],
    [
      "/expense-payments/p1/reverse",
      { method: "POST", body: { reason: "Correct entry", expectedVersion: 2 } },
    ],
  ]);
  for (const [summary, row, permissions, reason] of [
    [{ ...settlement, linked: true }, { ...payment, targetType: "VENDOR_BILL" }, pay, "Reason"],
    [settlement, { ...payment, reversedAt: "2026-11-04" }, pay, "Reason"],
    [settlement, { ...payment, expenseId: "other" }, pay, "Reason"],
    [settlement, payment, [], "Reason"],
    [settlement, payment, pay, " "],
  ])
    assert.throws(() => reverseExpensePayment(api, summary, row, reason, permissions));
  await assert.rejects(
    settleExpense(
      async () => {
        throw new Error("Expense changed");
      },
      settlement,
      input,
      pay,
      "stable-key",
    ),
    /Expense changed/,
  );
});

test("actual settlement form prevents duplicate submissions and refreshes authoritative list/detail data", async () => {
  let summary = structuredClone(settlement),
    release;
  const calls = [],
    refreshed = [];
  const api = async (path, options) => {
    calls.push([path, options]);
    if (options?.method === "POST") {
      await new Promise((resolve) => {
        release = resolve;
      });
      summary = {
        ...summary,
        payments: [payment],
        paidAmount: "0.10",
        balance: "0.20",
        settlementStatus: "PARTIALLY_PAID",
      };
      return payment;
    }
    return summary;
  };
  const harness = createHookHarness(ExpenseSettlementDialog, {
    id: "e1",
    api,
    permissions: pay,
    onClose() {},
    async onSaved() {
      refreshed.push("expense list/details");
    },
  });
  harness.render();
  await flushPromises();
  button(harness.render(), "Record settlement").props.onClick();
  let dialog = harness.render();
  const amount = find(
    dialog,
    (element) => element.type === "input" && element.props.inputMode === "decimal",
  );
  amount.props.onChange({ target: { value: "0.10" } });
  dialog = harness.render();
  const pending = dialog.props.onSubmit();
  await dialog.props.onSubmit();
  assert.equal(calls.filter(([, options]) => options?.method === "POST").length, 1);
  assert.equal(harness.render().props.submitting, true);
  release();
  await pending;
  dialog = harness.render();
  assert.equal(dialog.props.submitLabel, undefined);
  assert.equal(
    find(dialog, (element) => element.type?.name === "BillPaymentsTable").props.payments.length,
    1,
  );
  assert.deepEqual(refreshed, ["expense list/details"]);
  assert.ok(JSON.stringify(dialog.props.children).includes("0.20"));
  harness.unmount();
});

test("failed/lost response retries keep the idempotency key and confirmation open", async () => {
  const keys = [];
  const api = async (path, options) => {
    if (options?.method === "POST") {
      keys.push(options.body.idempotencyKey);
      throw new Error("Connection lost");
    }
    return settlement;
  };
  let saved = false;
  const harness = createHookHarness(ExpenseSettlementDialog, {
    id: "e1",
    api,
    permissions: pay,
    onClose() {},
    async onSaved() {
      saved = true;
    },
  });
  harness.render();
  await flushPromises();
  button(harness.render(), "Record settlement").props.onClick();
  await harness.render().props.onSubmit();
  await harness.render().props.onSubmit();
  assert.equal(keys.length, 2);
  assert.equal(keys[0], keys[1]);
  assert.equal(saved, false);
  assert.equal(harness.render().props.submitLabel, "Record settlement");
  assert.match(
    find(harness.render(), (element) => element.props?.role === "alert").props.children,
    /Connection lost/,
  );
  harness.unmount();
});

test("linked expenses show bill navigation and never expose direct payment/reversal controls", async () => {
  const linked = {
    ...settlement,
    linked: true,
    basis: "BILL",
    linkedBill: { id: "b1", billNumber: "B1", status: "APPROVED" },
    payments: [{ ...payment, targetType: "VENDOR_BILL", vendorBillId: "b1" }],
  };
  const harness = createHookHarness(ExpenseSettlementDialog, {
    id: "e1",
    api: async () => linked,
    permissions: pay,
    onClose() {},
    async onSaved() {},
  });
  harness.render();
  await flushPromises();
  const dialog = harness.render();
  assert.equal(button(dialog, "Record settlement"), undefined);
  assert.equal(find(dialog, (element) => element.type === "a").props.href, billHref("b1"));
  const table = find(dialog, (element) => element.type?.name === "BillPaymentsTable");
  assert.equal(table.props.canReverse(linked.payments[0]), false);
  harness.unmount();
});

test("expense reversal confirmation preserves history and server balance, with no duplicate click", async () => {
  let summary = {
    ...settlement,
    payments: [payment],
    paidAmount: "0.10",
    balance: "0.20",
    settlementStatus: "PARTIALLY_PAID",
  };
  let mutations = 0,
    saved = 0;
  const api = async (path, options) => {
    if (options?.method === "POST") {
      mutations++;
      summary = {
        ...settlement,
        payments: [{ ...payment, reversedAt: "2026-11-04", reversalReason: "Duplicate" }],
      };
    }
    return summary;
  };
  const harness = createHookHarness(ExpenseSettlementDialog, {
    id: "e1",
    api,
    permissions: pay,
    onClose() {},
    async onSaved() {
      saved++;
    },
  });
  harness.render();
  await flushPromises();
  find(harness.render(), (element) => element.type?.name === "BillPaymentsTable").props.onReverse(
    payment,
  );
  assert.equal(mutations, 0);
  let dialog = harness.render();
  assert.equal(dialog.props.submitLabel, "Confirm reversal");
  find(dialog, (element) => element.type === "textarea").props.onChange({
    target: { value: "Duplicate" },
  });
  dialog = harness.render();
  const pending = dialog.props.onSubmit();
  await dialog.props.onSubmit();
  await pending;
  assert.equal(mutations, 1);
  assert.equal(saved, 1);
  assert.equal(
    find(harness.render(), (element) => element.type?.name === "BillPaymentsTable").props
      .payments[0].reversedAt,
    "2026-11-04",
  );
  harness.unmount();
});

test("linked expense views respect permission, missing records and useful loading states", async () => {
  let requests = 0;
  const denied = createHookHarness(LinkedExpense, {
    id: "e1",
    canRead: false,
    api: async () => {
      requests++;
    },
  });
  assert.ok(JSON.stringify(denied.render().props.children).includes("permission"));
  await flushPromises();
  assert.equal(requests, 0);
  denied.unmount();
  const missing = createHookHarness(LinkedExpense, {
    id: "missing",
    canRead: true,
    api: async () => {
      throw new Error("Expense not found");
    },
  });
  assert.equal(missing.render().props.role, "status");
  await flushPromises();
  assert.equal(missing.render().props.role, "alert");
  missing.unmount();
  const linked = createHookHarness(LinkedExpense, {
    id: "e1",
    canRead: true,
    api: async () => ({ title: "Travel", approvalStatus: "APPROVED", settlement }),
  });
  linked.render();
  await flushPromises();
  assert.equal(
    find(linked.render(), (element) => element.type === "a").props.href,
    expenseHref("e1"),
  );
  linked.unmount();
});

test("settlement read failure renders an error and never exposes a payment action", async () => {
  const harness = createHookHarness(ExpenseSettlementDialog, {
    id: "missing",
    api: async () => {
      throw new Error("Expense not found");
    },
    permissions: pay,
    onClose() {},
    async onSaved() {},
  });
  harness.render();
  await flushPromises();
  const dialog = harness.render();
  assert.match(
    find(dialog, (element) => element.props?.role === "alert").props.children,
    /Expense not found/,
  );
  assert.equal(button(dialog, "Record settlement"), undefined);
  harness.unmount();
});
