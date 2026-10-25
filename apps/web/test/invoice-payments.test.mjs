import assert from "node:assert/strict";
import { test } from "node:test";
import { canRecordPayment, validatePayment } from "../src/features/invoices/schemas/payment.schema.ts";
import { recordInvoicePayment } from "../src/features/invoices/api/invoices.ts";
const input = { amount: "0.10", paymentDate: "2026-01-01", method: "CASH", reference: "", notes: "" };
test("payment validation handles exact balances, dates, methods and field limits", () => {
  assert.equal(validatePayment(input, "0.30"), "");
  assert.equal(validatePayment({ ...input, amount: "9999999999.99" }, "9999999999.99"), "");
  for (const amount of ["0", "-1", "0.001", "1e2", "0.31", "", "99999999999"])
    assert.ok(validatePayment({ ...input, amount }, "0.30"));
  for (const change of [{ paymentDate: "2026-02-30" }, { paymentDate: "2999-01-01" }, { method: "PAYPAL" }, { reference: "a".repeat(121) }, { notes: "a".repeat(2001) }])
    assert.ok(validatePayment({ ...input, ...change }, "0.30"));
});
test("payment controls require permission, finalized invoice and positive balance", () => {
  const invoice = { status: "ISSUED", issuedAt: "2026-01-01", outstandingBalance: "0.30" };
  const permissions = ["invoices:record-payment"];
  assert.equal(canRecordPayment(invoice, permissions), true);
  assert.equal(canRecordPayment({ ...invoice, status: "OVERDUE" }, permissions), true);
  assert.equal(canRecordPayment(invoice, ["invoices:read"]), false);
  for (const change of [{ status: "DRAFT" }, { status: "PAID" }, { status: "CANCELLED" }, { issuedAt: null }, { outstandingBalance: "0.00" }])
    assert.equal(canRecordPayment({ ...invoice, ...change }, permissions), false);
});
test("record payment sends version and fields and returns updated history", async () => {
  const result = { status: "PAID", outstandingBalance: "0.00", payments: [{ amount: "0.10" }] };
  const api = async (path, options) => {
    assert.equal(path, "/invoices/invoice-1/payments");
    assert.equal(options.method, "POST");
    assert.deepEqual(options.body, { ...input, expectedVersion: 2 });
    return result;
  };
  assert.equal(await recordInvoicePayment(api, "invoice-1", { ...input, expectedVersion: 2 }), result);
});
test("payment API errors propagate without automatic duplicate retries", async () => {
  let calls = 0;
  const api = async () => { calls++; throw new Error("Invoice changed"); };
  await assert.rejects(recordInvoicePayment(api, "invoice-1", { ...input, expectedVersion: 2 }), /Invoice changed/);
  assert.equal(calls, 1);
});
