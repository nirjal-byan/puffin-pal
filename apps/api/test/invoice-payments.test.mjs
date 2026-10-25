import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreatePaymentDto } from "../dist/src/modules/invoices/dto/create-payment.dto.js";
import { invoicePaymentSummary, paymentCents, receivedPaymentDate } from "../dist/src/modules/invoices/utils/invoice-payments.js";
import { hasPermission } from "@puffinpal/permissions";

const invoice = { status: "ISSUED", total: "0.30", dueDate: "2026-10-13T00:00:00Z", issuedAt: "2026-10-12T00:00:00Z" };
test("payment math stays exact, including decimal edges and maximum values", () => {
  assert.equal(paymentCents("9999999999.99"), 999999999999n);
  const partial = invoicePaymentSummary(invoice, [{ amount: "0.10" }], "2026-10-13");
  assert.equal(partial.totalPaid, "0.10");
  assert.equal(partial.outstandingBalance, "0.20");
  assert.equal(partial.displayStatus, "ISSUED");
  const paid = invoicePaymentSummary(invoice, [{ amount: "0.10" }, { amount: "0.20" }], "2026-10-14");
  assert.equal(paid.outstandingBalance, "0.00");
  assert.equal(paid.displayStatus, "PAID");
  assert.equal(paid.isOverdue, false);
  for (const value of ["-1", "1e2", "NaN", "0.001", "10000000000", "01", "1.", "", 10])
    assert.throws(() => paymentCents(value));
});
test("overdue is derived after the due date, excludes drafts/cancellations, and respects balances", () => {
  assert.equal(invoicePaymentSummary(invoice, [], "2026-10-13").isOverdue, false);
  assert.equal(invoicePaymentSummary(invoice, [], "2026-10-14").displayStatus, "OVERDUE");
  assert.equal(invoice.status, "ISSUED");
  for (const status of ["DRAFT", "CANCELLED", "PENDING"])
    assert.equal(invoicePaymentSummary({ ...invoice, status }, [], "2026-10-14").displayStatus, status);
  const historical = invoicePaymentSummary({ ...invoice, status: "PAID" }, [], "2026-10-14");
  assert.equal(historical.legacyPaid, true);
  assert.equal(historical.outstandingBalance, "0.00");
  assert.equal(invoicePaymentSummary({ ...invoice, total: "0.00" }, []).displayStatus, "PAID");
});
test("payment DTO rejects excessive precision, missing version and server-owned fields", async () => {
  const valid = { amount: "0.10", paymentDate: "2026-01-01", method: "CASH", expectedVersion: 2 };
  assert.equal((await validate(plainToInstance(CreatePaymentDto, valid))).length, 0);
  for (const change of [{ amount: "0.001" }, { amount: -1 }, { amount: "-1" }, { method: "PAYPAL" }, { expectedVersion: undefined }, { expectedVersion: 2147483647 }, { organizationId: "other" }, { totalPaid: "1.00" }, { status: "PAID" }, { reference: "x".repeat(121) }])
    assert.ok((await validate(plainToInstance(CreatePaymentDto, { ...valid, ...change }), { whitelist: true, forbidNonWhitelisted: true })).length);
});
test("payment dates must exist and cannot be in the future", () => {
  assert.equal(receivedPaymentDate("2024-02-29").toString(), "2024-02-29T00:00:00Z");
  for (const value of ["2025-02-29", "2026-02-30", "2999-01-01", "not-a-date", "2026-01-01T01:00Z"])
    assert.throws(() => receivedPaymentDate(value));
});
test("only owners and admins may record payments; all invoice readers may view them", () => {
  for (const role of ["OWNER", "ADMIN", "PROJECT_MANAGER", "FINANCE_VIEWER"]) {
    assert.equal(hasPermission(role, "invoices:record-payment"), ["OWNER", "ADMIN"].includes(role));
    assert.equal(hasPermission(role, "invoices:read"), true);
  }
});
