import assert from "node:assert/strict";
import { test } from "node:test";
import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import swc from "next/dist/build/swc/index.js";
import "react/jsx-runtime";
import { createHookHarness, flushPromises } from "./helpers/hook-harness.mjs";
import {
  billTransitions,
  canReversePayment,
  loadBillActivity,
  reasonError,
  reverseBillPayment,
  transitionBill,
} from "../src/features/accounts-payable/services/bill-workflow-api.ts";
const { useBillActivity } =
  await import("../src/features/accounts-payable/hooks/use-bill-activity.ts");
const { usePayableAction } =
  await import("../src/features/accounts-payable/hooks/use-payable-action.ts");
registerHooks({
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
const { BillActivityDialog } =
  await import("../src/features/accounts-payable/dialogs/bill-activity-dialog.tsx");
const manage = ["accounts-payable:manage"];
const approve = ["accounts-payable:approve"];
const pay = ["accounts-payable:pay"];
const bill = {
  id: "bill-1",
  billNumber: "B1",
  status: "PENDING_APPROVAL",
  settlementStatus: "UNPAID",
  version: 9,
  balance: "150.00",
  audit: [],
};
const payment = {
  id: "payment-1",
  vendorBillId: bill.id,
  targetType: "VENDOR_BILL",
  version: 3,
  amount: "50.00",
  currency: "USD",
  paymentDate: "2026-11-02T00:00:00Z",
  reference: "REF-1",
  reversedAt: null,
};

test("approval actions follow server states and separate preparation/approval permissions", () => {
  assert.deepEqual(billTransitions({ ...bill, status: "DRAFT" }, manage), ["submit"]);
  assert.deepEqual(billTransitions(bill, approve), ["approve", "reject"]);
  assert.deepEqual(billTransitions({ ...bill, status: "REJECTED" }, manage), ["resubmit"]);
  assert.deepEqual(billTransitions({ ...bill, status: "APPROVED" }, approve), ["void"]);
  assert.deepEqual(
    billTransitions({ ...bill, status: "APPROVED", settlementStatus: "PARTIALLY_PAID" }, approve),
    [],
  );
  for (const status of ["DRAFT", "PENDING_APPROVAL", "REJECTED", "APPROVED", "VOIDED"]) {
    assert.deepEqual(billTransitions({ ...bill, status }, []), []);
  }
  assert.deepEqual(billTransitions(bill, manage), []);
  assert.deepEqual(billTransitions({ ...bill, status: "REJECTED" }, approve), []);
  assert.deepEqual(billTransitions({ ...bill, status: "VOIDED" }, [...approve, ...manage]), []);
});

test("rejection and resubmission use existing endpoints with required reason and exact version", async () => {
  const calls = [];
  const api = async (...args) => {
    calls.push(args);
  };
  await transitionBill(api, bill, "reject", approve, "  Correct receipt  ");
  await transitionBill(api, { ...bill, status: "REJECTED", version: 10 }, "resubmit", manage);
  assert.deepEqual(calls, [
    [
      "/accounts-payable/bills/bill-1/reject",
      { method: "POST", body: { expectedVersion: 9, reason: "Correct receipt" } },
    ],
    ["/accounts-payable/bills/bill-1/resubmit", { method: "POST", body: { expectedVersion: 10 } }],
  ]);
  for (const reason of ["", "  ", "x".repeat(501)]) {
    assert.ok(reasonError(reason));
    assert.throws(() => transitionBill(api, bill, "reject", approve, reason));
  }
  assert.equal(calls.length, 2);
});

test("invalid transitions make no request and backend conflicts remain actionable", async () => {
  const api = () => assert.fail("invalid transition must not request");
  assert.throws(() => transitionBill(api, bill, "approve", manage));
  assert.throws(() => transitionBill(api, { ...bill, status: "REJECTED" }, "approve", approve));
  assert.throws(() =>
    transitionBill(api, { ...bill, status: "APPROVED", settlementStatus: "PAID" }, "void", approve),
  );
  await assert.rejects(
    transitionBill(
      async () => {
        throw new Error("Bill changed or is not awaiting approval");
      },
      bill,
      "reject",
      approve,
      "Wrong receipt",
    ),
    /Bill changed/,
  );
});

test("bill activity loads server balances and approval audit without unbounded embedded payments", async () => {
  const payments = [
    payment,
    {
      ...payment,
      id: "payment-2",
      reversedAt: "2026-11-03T00:00:00Z",
      reversalReason: "Duplicate",
    },
  ];
  const calls = [];
  const controller = new AbortController();
  const activity = await loadBillActivity(
    async (path, options) => {
      calls.push([path, options.signal]);
      return path.endsWith("/payments") ? payments : bill;
    },
    bill.id,
    controller.signal,
  );
  assert.equal(activity.bill.balance, "150.00");
  assert.deepEqual(activity.payments, []);
  assert.deepEqual(
    calls.map(([path]) => path),
    ["/accounts-payable/bills/bill-1?includeHistory=false"],
  );
  assert.ok(calls.every(([, signal]) => signal === controller.signal));
  assert.deepEqual(
    (await loadBillActivity(async (path) => (path.endsWith("/payments") ? [] : bill), bill.id))
      .payments,
    [],
  );
  await assert.rejects(
    loadBillActivity(async () => {
      throw new Error("Forbidden");
    }, bill.id),
    /Forbidden/,
  );
});

test("reversal posts version and reason without deleting or changing original amount", async () => {
  let call;
  await reverseBillPayment(
    async (...args) => {
      call = args;
    },
    bill.id,
    payment,
    pay,
    "  Duplicate entry ",
  );
  assert.deepEqual(call, [
    "/accounts-payable/payments/payment-1/reverse",
    { method: "POST", body: { expectedVersion: 3, reason: "Duplicate entry" } },
  ]);
  assert.equal(payment.amount, "50.00");
  assert.equal(payment.reversedAt, null);
});

test("reversal guards permission, prior reversal, bill identity, and reason", () => {
  const api = () => assert.fail("must not reverse");
  assert.equal(canReversePayment(payment, []), false);
  assert.equal(canReversePayment({ ...payment, reversedAt: "2026-11-03" }, pay), false);
  for (const [id, row, permissions, reason] of [
    [bill.id, payment, [], "Reason"],
    [bill.id, { ...payment, reversedAt: "2026-11-03" }, pay, "Reason"],
    ["other-bill", payment, pay, "Reason"],
    [bill.id, { ...payment, targetType: "EXPENSE" }, pay, "Reason"],
    [bill.id, payment, pay, " "],
    [bill.id, payment, pay, "x".repeat(501)],
  ])
    assert.throws(() => reverseBillPayment(api, id, row, permissions, reason));
});

test("bank reconciliation and stale payment conflicts surface without frontend balance changes", async () => {
  for (const message of [
    "Reverse the bank reconciliation before reversing this payment",
    "Payment changed, was reversed, or does not exist",
  ]) {
    await assert.rejects(
      reverseBillPayment(
        async () => {
          throw new Error(message);
        },
        bill.id,
        payment,
        pay,
        "Duplicate",
      ),
      { message },
    );
  }
});

test("activity hook exposes loading/error/retry and refreshes server payment history and balance", async () => {
  let failed = true;
  let reversed = false;
  const api = async (path) => {
    if (failed) throw new Error("History unavailable");
    if (path.endsWith("/payments"))
      return [{ ...payment, reversedAt: reversed ? "2026-11-03" : null }];
    return { ...bill, balance: reversed ? "200.00" : "150.00" };
  };
  const harness = createHookHarness(useBillActivity, api, bill.id);
  assert.equal(harness.render().loading, true);
  await flushPromises();
  assert.equal(harness.render().error, "History unavailable");
  failed = false;
  await harness.render().refresh();
  assert.equal(harness.render().data.bill.balance, "150.00");
  await reverseBillPayment(
    async () => {
      reversed = true;
    },
    bill.id,
    payment,
    pay,
    "Duplicate",
  );
  await harness.render().refresh();
  assert.equal(harness.render().data.bill.balance, "200.00");
  assert.deepEqual(harness.render().data.payments, []);
  assert.equal(harness.render().error, "");
  harness.unmount();
});

test("only the latest history request can update the dialog; unmount aborts requests", async () => {
  const requests = [];
  const api = (path, options) =>
    new Promise((resolve) => requests.push({ path, signal: options.signal, resolve }));
  const harness = createHookHarness(useBillActivity, api, bill.id);
  harness.render();
  await flushPromises();
  const reload = harness.render().refresh();
  assert.equal(requests[0].signal.aborted, true);
  requests[1].resolve({ ...bill, balance: "250.00" });
  await reload;
  requests[0].resolve({ ...bill, balance: "999.00" });
  await flushPromises();
  assert.equal(harness.render().data.bill.balance, "250.00");
  harness.unmount();
  assert.equal(requests[1].signal.aborted, true);
});

function findElement(node, predicate) {
  if (!node || typeof node !== "object") return undefined;
  if (predicate(node)) return node;
  for (const child of [node.props?.children].flat(Infinity)) {
    const found = findElement(child, predicate);
    if (found) return found;
  }
}

test("actual reversal dialog requires confirmation, blocks duplicate submission, and refreshes history and summary", async () => {
  let release;
  let posts = 0;
  let reversed = false;
  const notifications = [];
  const api = async (path, options) => {
    if (path.endsWith("/reverse")) {
      posts++;
      await new Promise((resolve) => {
        release = resolve;
      });
      reversed = true;
      return {};
    }
    if (path.endsWith("/payments"))
      return [{ ...payment, reversedAt: reversed ? "2026-11-03" : null }];
    return {
      ...bill,
      vendor: { name: "Supplier" },
      paidAmount: reversed ? "0.00" : "50.00",
      totalAmount: "200.00",
      balance: reversed ? "200.00" : "150.00",
    };
  };
  const props = {
    id: bill.id,
    api,
    permissions: pay,
    onClose() {},
    onEdit() {},
    onAttachments() {},
    async onSaved(message) {
      notifications.push(message);
    },
  };
  const harness = createHookHarness(BillActivityDialog, props);
  harness.render();
  await flushPromises();
  let dialog = harness.render();
  findElement(dialog, (element) => element.type?.name === "PagedPayments").props.onReverse(payment);
  dialog = harness.render();
  assert.equal(posts, 0, "selecting a payment must not reverse it");
  assert.equal(dialog.props.submitLabel, "Confirm payment reversal");
  assert.equal(dialog.props.submitDisabled, true, "a reason is required");
  findElement(dialog, (element) => element.type === "textarea").props.onChange({
    target: { value: "Duplicate record" },
  });
  dialog = harness.render();
  assert.equal(dialog.props.submitDisabled, false);
  const submit = dialog.props.onSubmit();
  await dialog.props.onSubmit();
  assert.equal(posts, 1);
  assert.equal(harness.render().props.submitting, true);
  assert.equal(notifications.length, 0);
  release();
  await submit;
  dialog = harness.render();
  const table = findElement(dialog, (element) => element.type?.name === "PagedPayments");
  assert.equal(table.props.revision, 1);
  assert.equal(dialog.props.submitLabel, undefined);
  assert.equal(notifications.length, 1, "parent summary/list refresh callback runs once");
  assert.ok(notifications[0].includes("Payment reversed"));
  harness.unmount();
});

test("actual reversal dialog preserves failed confirmation and shows reconciliation errors", async () => {
  let saved = false;
  const api = async (path) => {
    if (path.endsWith("/reverse"))
      throw new Error("Reverse the bank reconciliation before reversing this payment");
    return path.endsWith("/payments")
      ? [payment]
      : { ...bill, vendor: { name: "Supplier" }, paidAmount: "50.00", totalAmount: "200.00" };
  };
  const harness = createHookHarness(BillActivityDialog, {
    id: bill.id,
    api,
    permissions: pay,
    onClose() {},
    onEdit() {},
    onAttachments() {},
    async onSaved() {
      saved = true;
    },
  });
  harness.render();
  await flushPromises();
  findElement(
    harness.render(),
    (element) => element.type?.name === "PagedPayments",
  ).props.onReverse(payment);
  findElement(harness.render(), (element) => element.type === "textarea").props.onChange({
    target: { value: "Duplicate" },
  });
  await harness.render().props.onSubmit();
  const dialog = harness.render();
  assert.equal(dialog.props.submitLabel, "Confirm payment reversal");
  assert.equal(saved, false);
  const alert = findElement(dialog, (element) => element.props?.role === "alert");
  assert.ok(JSON.stringify(alert.props.children).includes("Reverse the bank reconciliation"));
  harness.unmount();
});

test("approval conflict keeps reason open and explicit reload disables an outdated action", async () => {
  const { BillTransitionDialog } =
    await import("../src/features/accounts-payable/dialogs/bill-transition-dialog.tsx");
  let closed = false;
  const api = async (path, options) => {
    if (options?.method === "POST") throw new Error("Bill changed or is not awaiting approval");
    return { ...bill, status: "APPROVED", version: 10 };
  };
  const harness = createHookHarness(BillTransitionDialog, {
    bill,
    transition: "reject",
    api,
    permissions: approve,
    onClose() {
      closed = true;
    },
    async onSaved() {
      assert.fail("failed rejection must not report success");
    },
  });
  let dialog = harness.render();
  findElement(dialog, (element) => element.type === "textarea").props.onChange({
    target: { value: "Wrong receipt" },
  });
  await harness.render().props.onSubmit();
  dialog = harness.render();
  assert.equal(closed, false);
  assert.equal(
    findElement(dialog, (element) => element.type === "textarea").props.value,
    "Wrong receipt",
  );
  assert.ok(
    JSON.stringify(
      findElement(dialog, (element) => element.props?.role === "alert").props.children,
    ).includes("Bill changed"),
  );
  const reload = findElement(
    dialog,
    (element) => element.type === "button" && element.props.children === "Reload latest bill",
  );
  await reload.props.onClick();
  await flushPromises();
  assert.equal(harness.render().props.submitDisabled, true);
  harness.unmount();
});

test("debounced search submits only the latest text and cancels pending work on unmount", async (t) => {
  const { DebouncedSearch } = await import("../src/components/ui/debounced-search.tsx");
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const changes = [];
  const harness = createHookHarness(DebouncedSearch, {
    value: "",
    onChange: (value) => changes.push(value),
  });
  harness.render();
  await flushPromises();
  harness.render().props.onChange({ target: { value: "ven" } });
  t.mock.timers.tick(200);
  assert.deepEqual(changes, []);
  harness.render().props.onChange({ target: { value: "vendor" } });
  t.mock.timers.tick(250);
  assert.deepEqual(changes, ["vendor"]);
  harness.render().props.onChange({ target: { value: "cancelled" } });
  harness.unmount();
  t.mock.timers.tick(250);
  assert.deepEqual(changes, ["vendor"]);
});
