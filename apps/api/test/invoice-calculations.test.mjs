import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { calculateInvoice } from "../dist/src/modules/invoices/utils/invoice-calculations.js";
import { invoiceDates } from "../dist/src/modules/invoices/utils/invoice-dates.js";
import { CreateInvoiceDto } from "../dist/src/modules/invoices/dto/create-invoice.dto.js";
const item = (quantity, unitPrice) => ({
  description: "Work",
  quantity,
  unitPrice,
});
test("money is calculated exactly and formatted with two places", () => {
  const result = calculateInvoice([
    item(3, "0.10"),
    item(2, "0.20"),
    item(1, "0"),
  ]);
  assert.equal(result.subtotal, "0.70");
  assert.equal(result.total, "0.70");
  assert.equal(result.tax, "0.00");
  assert.deepEqual(
    result.items.map((row) => row.amount),
    ["0.30", "0.40", "0.00"],
  );
  assert.equal(
    calculateInvoice([item(1, "9999999999.99")]).total,
    "9999999999.99",
  );
});
test("unsupported quantities, prices and overflow are rejected", () => {
  for (const quantity of [0, -1, 1.5, 2147483648, "2"])
    assert.throws(() => calculateInvoice([item(quantity, "1.00")]));
  for (const price of [
    "-1",
    "0.001",
    "1e2",
    "NaN",
    "01.00",
    "10000000000",
    0.1,
  ])
    assert.throws(() => calculateInvoice([item(1, price)]));
  assert.throws(() => calculateInvoice([item(2, "9999999999.99")]));
  assert.throws(() =>
    calculateInvoice([item(1, "9999999999.99"), item(1, "0.01")]),
  );
  assert.throws(() => calculateInvoice([]));
});
test("dates are calendar-valid, explicit about timezone, and chronologically ordered", () => {
  assert.equal(
    invoiceDates("2026-10-10", "2026-10-10").issueDate.toString(),
    "2026-10-10T00:00:00Z",
  );
  assert.throws(() => invoiceDates("2026-02-30", "2026-03-01"));
  assert.throws(() => invoiceDates("2026-10-10", "2026-10-09"));
  assert.throws(() => invoiceDates("2026-10-10T12:00:00", "2026-10-11"));
  assert.throws(() =>
    invoiceDates("2026-10-10T12:00:00Z", "2026-10-10T12:00:00+05:45"),
  );
});
test("nested DTO validation rejects injected totals, tenant IDs and invalid items", async () => {
  const valid = {
    clientId: "74e344ea-2106-454a-8f25-744c2a186073",
    issueDate: "2026-10-10",
    dueDate: "2026-10-11",
    items: [item(1, "1.00")],
  };
  const check = async (data) =>
    validate(plainToInstance(CreateInvoiceDto, data), {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
  assert.equal((await check(valid)).length, 0);
  for (const patch of [
    { clientId: "not-a-uuid" },
    { items: [] },
    { items: [null] },
    { items: [item(0, "1.00")] },
    { items: [{ ...item(1, "1.00"), description: " " }] },
    { items: [{ ...item(1, "1.00"), amount: "0.00" }] },
    { organizationId: "other" },
    { total: "0.00" },
    { currency: "EUR" },
    { notes: null },
    { issueDate: "2026-02-30" },
  ]) {
    assert.ok(
      (await check({ ...valid, ...patch })).length > 0,
      JSON.stringify(patch),
    );
  }
});
