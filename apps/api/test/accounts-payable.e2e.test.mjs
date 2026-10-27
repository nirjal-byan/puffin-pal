import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { createApplication } from "../dist/src/app.factory.js";
import { DATABASE } from "../dist/src/infrastructure/database/database.module.js";
import { Temporal } from "temporal-polyfill";

test("accounts payable enforces tenant, lifecycle, idempotency, and concurrent balances", async () => {
  assert.match(new URL(process.env.DATABASE_URL).pathname, /^\/puffinpal_auth_test_/);
  const app = await createApplication(true);
  await app.listen(0, "127.0.0.1");
  const base = `${await app.getUrl()}/api/v1`;
  const db = app.get(DATABASE);
  async function request(path, token, body, method = "POST", expected = 200) {
    const response = await fetch(base + path, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const value = await response.json();
    assert.equal(response.status, expected, JSON.stringify(value));
    return value;
  }
  try {
    const password = "Payables-password-123";
    const owner = await request(
      "/auth/signup",
      "",
      {
        organizationName: "Payables",
        organizationSlug: "payables-owner",
        fullName: "Owner",
        email: "owner@payables.test",
        password,
      },
      "POST",
      201,
    );
    const other = await request(
      "/auth/signup",
      "",
      {
        organizationName: "Other",
        organizationSlug: "payables-other",
        fullName: "Other",
        email: "other@payables.test",
        password,
      },
      "POST",
      201,
    );
    const vendor = await request(
      "/vendors",
      owner.accessToken,
      {
        name: "Paper Supply",
        displayName: "Paper Supply",
        email: "billing@paper.test",
        phone: "",
        website: "",
        address: "",
        country: "US",
        defaultCurrency: "USD",
        taxId: "",
        paymentTermsDays: 30,
        notes: "",
      },
      "POST",
      201,
    );
    const isolated = await request(
      "/vendors?limit=50&offset=0",
      other.accessToken,
      undefined,
      "GET",
    );
    assert.equal(isolated.total, 0);
    const archivedVendor = await request(
      "/vendors",
      owner.accessToken,
      {
        name: "Office Supply",
        displayName: "",
        email: "",
        phone: "",
        website: "",
        address: "",
        country: "",
        defaultCurrency: "USD",
        taxId: "",
        paymentTermsDays: 15,
        notes: "",
      },
      "POST",
      201,
    );
    const editedVendor = await request(
      `/vendors/${archivedVendor.id}`,
      owner.accessToken,
      {
        name: "Office Supplies",
        displayName: "",
        email: "",
        phone: "",
        website: "",
        address: "",
        country: "",
        defaultCurrency: "USD",
        taxId: "",
        paymentTermsDays: 15,
        notes: "",
        expectedVersion: archivedVendor.version,
      },
      "PATCH",
    );
    const archived = await request(
      `/vendors/${archivedVendor.id}/archive`,
      owner.accessToken,
      undefined,
      "POST",
    );
    assert.equal(editedVendor.name, "Office Supplies");
    assert.equal(archived.active, false);
    const billInput = {
      vendorId: vendor.id,
      billNumber: "PS-100",
      issueDate: "2026-10-01",
      dueDate: "2026-10-31",
      currency: "USD",
      items: [
        {
          description: "Paper",
          quantity: "2",
          unitPrice: "5.00",
          taxAmount: "1.00",
          discountAmount: "1.00",
        },
      ],
    };
    const bill = await request(
      "/accounts-payable/bills",
      owner.accessToken,
      billInput,
      "POST",
      201,
    );
    assert.equal(bill.totalAmount, "10.00");
    await request("/accounts-payable/bills", owner.accessToken, billInput, "POST", 409);
    const submitted = await request(
      `/accounts-payable/bills/${bill.id}/submit`,
      owner.accessToken,
      { expectedVersion: bill.version },
    );
    const approved = await request(
      `/accounts-payable/bills/${bill.id}/approve`,
      owner.accessToken,
      { expectedVersion: submitted.version },
    );
    const first = await request(
      `/accounts-payable/bills/${bill.id}/payments`,
      owner.accessToken,
      {
        amount: "4.00",
        paymentDate: "2026-10-20",
        method: "BANK_TRANSFER",
        reference: "PAY-1",
        idempotencyKey: "payables-test-payment-1",
      },
      "POST",
      201,
    );
    const duplicate = await request(
      `/accounts-payable/bills/${bill.id}/payments`,
      owner.accessToken,
      {
        amount: "4.00",
        paymentDate: "2026-10-20",
        method: "BANK_TRANSFER",
        reference: "PAY-1",
        idempotencyKey: "payables-test-payment-1",
      },
      "POST",
      201,
    );
    assert.equal(duplicate.id, first.id);
    const account = await request(
      "/banking/accounts",
      owner.accessToken,
      {
        displayName: "Operating",
        bankName: "Test Bank",
        accountHolder: "Payables",
        maskedIdentifier: "•••• 1234",
        currency: "USD",
        countryCode: "US",
      },
      "POST",
      201,
    );
    await request(
      "/banking/imports",
      owner.accessToken,
      {
        bankAccountId: account.id,
        fileName: "payables.csv",
        csv: "date,amount,description,reference,direction\n2026-10-20,4.00,Paper payment,PAY-1,DEBIT",
        mapping: {
          date: "date",
          amount: "amount",
          description: "description",
          reference: "reference",
          direction: "direction",
        },
      },
      "POST",
      201,
    );
    const transactions = await request(
      `/banking/transactions?bankAccountId=${account.id}`,
      owner.accessToken,
      undefined,
      "GET",
    );
    const suggestions = await request(
      `/banking/transactions/${transactions[0].id}/suggestions`,
      owner.accessToken,
      undefined,
      "GET",
    );
    assert.ok(suggestions.some((suggestion) => suggestion.targetId === first.id));
    const reconciliation = await request(
      `/banking/transactions/${transactions[0].id}/reconcile`,
      owner.accessToken,
      { targetType: "PAYABLE_PAYMENT", targetId: first.id },
      "POST",
      201,
    );
    await request(
      `/accounts-payable/payments/${first.id}/reverse`,
      owner.accessToken,
      { expectedVersion: first.version, reason: "Must reverse reconciliation first" },
      "POST",
      409,
    );
    await request(`/banking/reconciliations/${reconciliation.id}/reverse`, owner.accessToken, {
      expectedVersion: reconciliation.version,
      reason: "Test correction",
    });
    await request(
      `/accounts-payable/bills/${bill.id}/payments`,
      owner.accessToken,
      {
        amount: "7.00",
        paymentDate: "2026-10-20",
        method: "BANK_TRANSFER",
        idempotencyKey: "payables-test-overpay",
      },
      "POST",
      409,
    );
    const attempts = await Promise.all(
      ["a", "b"].map(async (suffix) =>
        fetch(`${base}/accounts-payable/bills/${bill.id}/payments`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${owner.accessToken}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            amount: "6.00",
            paymentDate: "2026-10-21",
            method: "BANK_TRANSFER",
            idempotencyKey: `payables-concurrent-${suffix}`,
          }),
        }),
      ),
    );
    assert.deepEqual(attempts.map((response) => response.status).sort(), [201, 409]);
    const detail = await request(
      `/accounts-payable/bills/${bill.id}`,
      owner.accessToken,
      undefined,
      "GET",
    );
    assert.equal(detail.balance, "0.00");
    assert.equal(detail.settlementStatus, "PAID");
    const completed = detail.payments.find(
      (payment) => payment.id !== first.id && !payment.reversedAt,
    );
    await request(`/accounts-payable/payments/${completed.id}/reverse`, owner.accessToken, {
      expectedVersion: completed.version,
      reason: "Test correction",
    });
    const restored = await request(
      `/accounts-payable/bills/${bill.id}`,
      owner.accessToken,
      undefined,
      "GET",
    );
    assert.equal(restored.balance, "6.00");
    assert.equal(restored.settlementStatus, "PARTIALLY_PAID");
    const summary = await request("/accounts-payable/aging", owner.accessToken, undefined, "GET");
    assert.equal(summary.outstanding, "6.00");
    assert.equal(summary.vendorBalances[0].balance, "6.00");
    const standaloneExpense = await db.orm.public.Expense.create({
      organizationId: owner.organization.id,
      title: "Standalone expense",
      amount: "8.00",
      category: "OTHER",
      date: Temporal.Instant.from("2026-10-01T00:00:00Z"),
      approvalStatus: "APPROVED",
      createdByUserId: owner.user.id,
    });
    const expensePayment = await request(
      `/expenses/${standaloneExpense.id}/payments`,
      owner.accessToken,
      {
        amount: "3.00",
        paymentDate: "2026-10-20",
        method: "CASH",
        idempotencyKey: "standalone-expense-payment",
      },
      "POST",
      201,
    );
    await request(`/expense-payments/${expensePayment.id}/reverse`, owner.accessToken, {
      expectedVersion: expensePayment.version,
      reason: "Cash entry correction",
    });
    const expense = await db.orm.public.Expense.create({
      organizationId: owner.organization.id,
      title: "Linked expense",
      amount: "5.00",
      category: "OTHER",
      date: Temporal.Instant.from("2026-10-01T00:00:00Z"),
      approvalStatus: "APPROVED",
      createdByUserId: owner.user.id,
    });
    await db.orm.public.VendorBill.create({
      organizationId: owner.organization.id,
      vendorId: vendor.id,
      expenseId: expense.id,
      billNumber: "PS-101",
      issueDate: Temporal.Instant.from("2026-10-01T00:00:00Z"),
      dueDate: Temporal.Instant.from("2026-10-31T00:00:00Z"),
      currency: "USD",
      subtotal: "5.00",
      totalAmount: "5.00",
      status: "APPROVED",
      createdById: owner.user.id,
    });
    await request(
      `/expenses/${expense.id}/payments`,
      owner.accessToken,
      {
        amount: "5.00",
        paymentDate: "2026-10-20",
        method: "CASH",
        idempotencyKey: "linked-expense-payment",
      },
      "POST",
      409,
    );
    assert.equal(approved.status, "APPROVED");
  } finally {
    await app.close();
  }
});
