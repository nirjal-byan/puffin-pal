import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { AccountsPayableService } from "../dist/src/modules/accounts-payable/accounts-payable.service.js";
import { AccountsPayableController } from "../dist/src/modules/accounts-payable/accounts-payable.controller.js";
import { REQUIRED_PERMISSIONS } from "../dist/src/common/decorators/auth.decorators.js";
import { CashFlowService } from "../dist/src/modules/cash-flow/cash-flow.service.js";
import { FinancialReportsService } from "../dist/src/modules/financial-reports/financial-reports.service.js";
import { settlementSummary } from "../dist/src/modules/accounts-payable/settlement-summary.js";

const date = "2026-11-04T00:00:00Z";
function fixture({ linked = false, approved = true, role = "OWNER" } = {}) {
  const filters = [],
    audit = [],
    payments = [];
  const expense = {
    id: "expense-1",
    organizationId: "org-a",
    amount: "0.30",
    approvalStatus: approved ? "APPROVED" : "DRAFT",
    date,
  };
  const bill = {
    id: "bill-1",
    expenseId: expense.id,
    organizationId: "org-a",
    totalAmount: "0.30",
    currency: "USD",
    billNumber: "B1",
    status: "APPROVED",
    dueDate: date,
  };
  const rows = {
    Vendor: [{ id: "vendor-1", organizationId: "org-a", active: true }],
    VendorBillItem: [],
    Expense: [expense],
    VendorBill: linked ? [bill] : [],
    PayablePayment: payments,
    Organization: [{ id: "org-a", currency: "USD" }],
    BankReconciliation: [],
    PayableAuditEvent: audit,
  };
  let nextId = 0;
  const models = Object.fromEntries(
    Object.entries(rows).map(([name, values]) => [
      name,
      {
        where(filter) {
          filters.push([name, filter]);
          const matching = () =>
            values.filter((row) =>
              Object.entries(filter).every(([key, value]) => row[key] === value),
            );
          return {
            async first() {
              return matching()[0] ?? null;
            },
            async all() {
              return matching();
            },
            orderBy() {
              return this;
            },
            async updateAll(data) {
              const found = matching();
              for (const row of found) Object.assign(row, data);
              return found;
            },
          };
        },
        async create(data) {
          const row = { id: `row-${++nextId}`, reversedAt: null, version: 1, ...data };
          values.push(row);
          return row;
        },
      },
    ]),
  );
  const db = {
    orm: { public: models },
    async transaction(run) {
      return run(db);
    },
    async execute() {},
    raw: {
      sql() {
        return {
          affectedCount() {
            return this;
          },
          build() {
            return {};
          },
        };
      },
    },
  };
  const service = new AccountsPayableService(
    db,
    { auth: { organizationId: "org-a", userId: "user-a", role } },
    {},
  );
  return { db, service, filters, audit, payments, expense, bill, rows };
}
const input = (amount, idempotencyKey = "request-001") => ({
  targetType: "EXPENSE",
  targetId: "expense-1",
  amount,
  paymentDate: "2026-11-04",
  method: "CASH",
  idempotencyKey,
});

test("standalone partial/full settlements and reversals stay exact and preserve history", async () => {
  const f = fixture();
  const first = await f.service.recordPayment(input("0.10"));
  let summary = await f.service.expenseSettlement(f.expense.id);
  assert.equal(summary.paidAmount, "0.10");
  assert.equal(summary.balance, "0.20");
  assert.equal(summary.settlementStatus, "PARTIALLY_PAID");
  await f.service.recordPayment(input("0.20", "request-002"));
  summary = await f.service.expenseSettlement(f.expense.id);
  assert.equal(summary.balance, "0.00");
  assert.equal(summary.settlementStatus, "PAID");
  await f.service.reversePayment(first.id, { expectedVersion: 1, reason: "Correction" }, "EXPENSE");
  summary = await f.service.expenseSettlement(f.expense.id);
  assert.equal(summary.balance, "0.10");
  assert.equal(summary.settlementStatus, "PARTIALLY_PAID");
  assert.equal(summary.payments.length, 2);
  assert.ok(summary.payments[0].reversedAt);
  assert.equal(f.audit.at(-1).action, "PAYMENT_REVERSED");
});

test("duplicate key retries create one payment; overpayments, invalid amounts and draft payments fail", async () => {
  const f = fixture();
  const first = await f.service.recordPayment(input("0.10"));
  assert.equal((await f.service.recordPayment(input("0.10"))).id, first.id);
  assert.equal(f.payments.length, 1);
  await assert.rejects(
    f.service.recordPayment(input("0.21", "request-002")),
    /outstanding balance/,
  );
  for (const value of ["0", "-1", "0.001", "NaN"])
    await assert.rejects(f.service.recordPayment(input(value, "request-bad")));
  await assert.rejects(
    fixture({ approved: false }).service.recordPayment(input("0.10")),
    /approved expenses/,
  );
});

test("linked bill is the sole settlement authority and its reversal restores the linked expense balance", async () => {
  const f = fixture({ linked: true });
  await assert.rejects(f.service.recordPayment(input("0.10")), /linked vendor bill/);
  const payment = await f.service.recordPayment({
    ...input("0.10"),
    targetType: "VENDOR_BILL",
    targetId: f.bill.id,
  });
  let summary = await f.service.expenseSettlement(f.expense.id);
  assert.equal(summary.basis, "BILL");
  assert.equal(summary.linkedBill.id, f.bill.id);
  assert.equal(summary.balance, "0.20");
  assert.equal(f.payments.length, 1);
  await f.service.reversePayment(
    payment.id,
    { expectedVersion: 1, reason: "Duplicate" },
    "VENDOR_BILL",
  );
  summary = await f.service.expenseSettlement(f.expense.id);
  assert.equal(summary.balance, "0.30");
  assert.equal(summary.settlementStatus, "UNPAID");
  assert.ok(summary.payments[0].reversedAt);
});

test("settlement reads reject missing/another-tenant IDs and scope all financial queries", async () => {
  const f = fixture({ linked: true });
  await assert.rejects(f.service.expenseSettlement("other-tenant-id"), /Expense not found/);
  await f.service.expenseSettlement(f.expense.id);
  for (const [model, filter] of f.filters)
    if (model !== "Organization") assert.equal(filter.organizationId, "org-a");
  const restricted = fixture({ linked: true, role: "UNKNOWN" });
  restricted.payments.push({
    amount: "0.10",
    currency: "USD",
    organizationId: "org-a",
    vendorBillId: "bill-1",
    reversedAt: null,
  });
  const summary = await restricted.service.expenseSettlement("expense-1");
  assert.equal(summary.linked, true);
  assert.equal(summary.linkedBill, null);
  assert.deepEqual(summary.payments, []);
});

test("reversal endpoints enforce target-specific permission and version/reconciliation constraints", async () => {
  assert.deepEqual(
    Reflect.getMetadata(
      REQUIRED_PERMISSIONS,
      AccountsPayableController.prototype.expenseSettlement,
    ),
    ["expenses:read"],
  );
  assert.deepEqual(
    Reflect.getMetadata(REQUIRED_PERMISSIONS, AccountsPayableController.prototype.payExpense),
    ["expenses:pay"],
  );
  assert.deepEqual(
    Reflect.getMetadata(
      REQUIRED_PERMISSIONS,
      AccountsPayableController.prototype.reverseExpensePayment,
    ),
    ["expenses:pay"],
  );
  const f = fixture();
  const payment = await f.service.recordPayment(input("0.10"));
  await assert.rejects(
    f.service.reversePayment(
      payment.id,
      { expectedVersion: 1, reason: "Wrong route" },
      "VENDOR_BILL",
    ),
    /Payment changed/,
  );
  await assert.rejects(
    f.service.reversePayment(payment.id, { expectedVersion: 2, reason: "Stale" }, "EXPENSE"),
    /Payment changed/,
  );
  f.rows.BankReconciliation.push({
    organizationId: "org-a",
    payablePaymentId: payment.id,
    reversedAt: null,
  });
  await assert.rejects(
    f.service.reversePayment(payment.id, { expectedVersion: 1, reason: "Reconciled" }, "EXPENSE"),
    /bank reconciliation/,
  );
  assert.equal(payment.reversedAt, null);
});

test("summary excludes reversed and other-currency payments without losing cents", () => {
  assert.deepEqual(
    settlementSummary("9999999999.99", "USD", [
      { amount: "0.10", currency: "USD", reversedAt: null },
      { amount: "999.00", currency: "EUR", reversedAt: null },
      { amount: "50.00", currency: "USD", reversedAt: date },
    ]),
    {
      currency: "USD",
      totalAmount: "9999999999.99",
      paidAmount: "0.10",
      balance: "9999999999.89",
      settlementStatus: "PARTIALLY_PAID",
    },
  );
});

test("cash forecast never counts a linked expense twice, including draft/rejected/voided bills", async () => {
  for (const status of ["DRAFT", "REJECTED", "VOIDED", "APPROVED"]) {
    const f = fixture({ linked: true });
    f.bill.status = status;
    const events = [];
    const forecast = new CashFlowService(f.db, { auth: { organizationId: "org-a" } });
    await forecast.expenseEvents("org-a", "USD", "2026-11-01", "2026-11-30", events);
    assert.equal(events.filter((event) => event.id.startsWith("expense:")).length, 0);
    assert.equal(events.length, status === "APPROVED" ? 1 : 0);
  }
});

test("forecast emits one partial cash payment plus remaining obligation, and reversals restore obligation", async () => {
  const f = fixture({ linked: true });
  const payment = await f.service.recordPayment({
    ...input("0.10"),
    targetType: "VENDOR_BILL",
    targetId: f.bill.id,
  });
  const forecast = new CashFlowService(f.db, { auth: { organizationId: "org-a" } });
  const events = [];
  await forecast.expenseEvents("org-a", "USD", "2026-11-01", "2026-11-30", events);
  assert.deepEqual(
    events.map((row) => row.amountCents),
    [10n, 20n],
  );
  payment.reversedAt = date;
  const after = [];
  await forecast.expenseEvents("org-a", "USD", "2026-11-01", "2026-11-30", after);
  assert.deepEqual(
    after.map((row) => row.amountCents),
    [30n],
  );
  payment.reversedAt = null;
  payment.currency = "EUR";
  await assert.rejects(
    forecast.expenseEvents("org-a", "USD", "2026-11-01", "2026-11-30", []),
    /one organization currency/,
  );
});

test("expense report query isolates expense and settlement currency and counts costs separately from cash", async () => {
  let sql;
  const db = {
    raw: {
      sql(strings) {
        sql = strings.join("?");
        return {
          returnsRow() {
            return this;
          },
          build() {
            return {};
          },
        };
      },
    },
    runtime() {
      return {
        async query() {
          return [{ payload: "{}" }];
        },
      };
    },
  };
  const service = new FinancialReportsService(db, {
    auth: { organizationId: "org-a", role: "OWNER" },
  });
  await service.report({ from: "2026-11-01", to: "2026-11-30", currency: "USD", groupBy: "month" });
  assert.match(sql, /b.currency = \(SELECT currency FROM organizations WHERE id/);
  assert.match(sql, /pp.currency = \(SELECT currency FROM bounds\)/);
  assert.match(sql, /pp\."reversedAt" IS NULL/);
  assert.match(sql, /pp\."expenseId"=ep.id OR pp\."vendorBillId"=vb.id/);
});

test("linking rejects already-paid expenses and existing legacy direct payments block another bill payment", async () => {
  const f = fixture();
  await f.service.recordPayment(input("0.10"));
  await assert.rejects(
    f.service.createBill({
      vendorId: "vendor-1",
      expenseId: "expense-1",
      billNumber: "B-NEW",
      issueDate: "2026-11-04",
      dueDate: "2026-11-05",
      currency: "USD",
      items: [{ description: "Cost", quantity: "1", unitPrice: "0.30" }],
    }),
    /Reverse direct expense payments/,
  );
  f.rows.VendorBill.push(f.bill);
  await assert.rejects(
    f.service.recordPayment({
      ...input("0.10", "another-payment"),
      targetType: "VENDOR_BILL",
      targetId: f.bill.id,
    }),
    /Reverse existing direct expense payments/,
  );
  const summary = await f.service.expenseSettlement(f.expense.id);
  assert.equal(summary.directPayments.length, 1);
  assert.equal(summary.payments.length, 0);
  assert.equal(f.payments.length, 1);
});
