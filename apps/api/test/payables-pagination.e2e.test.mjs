import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { Temporal } from "temporal-polyfill";
import { createApplication } from "../dist/src/app.factory.js";
import { DATABASE } from "../dist/src/infrastructure/database/database.module.js";

test("database pagination filters and counts financial records without changing totals or leaking tenants", async () => {
  assert.match(new URL(process.env.DATABASE_URL).pathname, /^\/puffinpal_auth_test_/);
  const app = await createApplication(true);
  await app.listen(0, "127.0.0.1");
  const db = app.get(DATABASE);
  const base = `${await app.getUrl()}/api/v1`;
  async function request(path, token, body, expected = 200) {
    const result = await fetch(base + path, {
      method: body ? "POST" : "GET",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await result.json();
    assert.equal(result.status, expected, path + " " + JSON.stringify(data));
    return data;
  }
  try {
    const signup = (slug) =>
      request(
        "/auth/signup",
        null,
        {
          organizationName: slug,
          organizationSlug: slug,
          fullName: "Owner",
          email: `${slug}@test.example`,
          password: "Pagination-password-123",
        },
        201,
      );
    const owner = await signup("page-owner");
    const other = await signup("page-other");
    const token = owner.accessToken;
    const organizationId = owner.organization.id;
    const vendors = [];
    for (let i = 0; i < 105; i++)
      vendors.push(
        await db.orm.public.Vendor.create({
          organizationId,
          name: `Vendor ${String(i).padStart(3, "0")}`,
          email: `v${i}@example.com`,
          defaultCurrency: "USD",
          paymentTermsDays: 30,
        }),
      );
    await db.orm.public.Vendor.create({
      organizationId: other.organization.id,
      name: "Other secret",
      defaultCurrency: "USD",
      paymentTermsDays: 30,
    });
    const expenses = [];
    for (let i = 0; i < 21; i++)
      expenses.push(
        await db.orm.public.Expense.create({
          organizationId,
          title: `Expense ${String(i).padStart(3, "0")}`,
          amount: "10.00",
          category: "SOFTWARE",
          date: Temporal.Instant.from("2026-11-01T00:00:00Z"),
          approvalStatus: "APPROVED",
          createdByUserId: owner.user.id,
        }),
      );
    const bills = [];
    for (let i = 0; i < 105; i++)
      bills.push(
        await db.orm.public.VendorBill.create({
          organizationId,
          vendorId: vendors[i].id,
          expenseId: i === 0 ? expenses[0].id : null,
          billNumber: `B-${String(i).padStart(3, "0")}`,
          vendorReference: `Ref ${i}`,
          issueDate: Temporal.Instant.from("2026-11-01T00:00:00Z"),
          dueDate: Temporal.Instant.from(i === 1 ? "2026-11-30T00:00:00Z" : "2026-12-01T00:00:00Z"),
          currency: "USD",
          subtotal: "10.00",
          totalAmount: "10.00",
          status: i === 0 ? "APPROVED" : "DRAFT",
          createdById: owner.user.id,
        }),
      );
    for (let i = 0; i < 25; i++)
      await db.orm.public.PayablePayment.create({
        organizationId,
        targetType: "VENDOR_BILL",
        vendorBillId: bills[0].id,
        amount: "0.10",
        currency: "USD",
        paymentDate: Temporal.Instant.from("2026-11-04T00:00:00Z"),
        method: i % 2 ? "CASH" : "CARD",
        idempotencyKey: `pagination-${i}`,
        recordedById: owner.user.id,
        ...(i === 0
          ? {
              reversedAt: Temporal.Instant.from("2026-11-05T00:00:00Z"),
              reversalReason: "Correction",
            }
          : {}),
      });
    const first = await request("/vendors?limit=20&offset=0&sort=name&order=asc", token);
    const last = await request("/vendors?limit=20&offset=100&sort=name&order=asc", token);
    assert.equal((await request("/vendors", token)).items.length, 50);
    assert.equal(
      (await request("/vendors?sort=name&order=desc&limit=1", token)).items[0].name,
      "Vendor 104",
    );
    assert.equal(
      (await request("/vendors?search=" + encodeURIComponent("%' OR 1=1 --"), token)).total,
      0,
    );
    assert.equal(first.total, 105);
    assert.equal(first.items.length, 20);
    assert.equal(last.items.length, 5);
    assert.equal(last.items[0].name, "Vendor 100");
    assert.equal((await request("/vendors?search=Vendor%20104", token)).total, 1);
    await db.orm.public.Vendor.where({ organizationId, id: vendors[104].id }).updateAll({
      active: false,
    });
    assert.equal((await request("/vendors?active=false", token)).total, 1);
    assert.equal((await request("/vendors?limit=20&offset=200", token)).items.length, 0);
    assert.equal((await request("/vendors", other.accessToken)).total, 1);
    const partial = await request(
      "/accounts-payable/bills?settlementStatus=PARTIALLY_PAID&limit=10",
      token,
    );
    assert.equal(partial.total, 1);
    assert.equal(partial.items[0].paidAmount, "2.40");
    assert.equal(partial.items[0].balance, "7.60");
    assert.equal((await request("/accounts-payable/bills?status=DRAFT", token)).total, 104);
    assert.equal(
      (await request(`/accounts-payable/bills?vendorId=${vendors[4].id}`, token)).items[0].id,
      bills[4].id,
    );
    assert.equal(
      (await request("/accounts-payable/bills?from=2026-11-30&to=2026-11-30", token)).total,
      1,
    );
    assert.equal(
      (await request("/accounts-payable/bills?search=Ref%20104", token)).items[0].id,
      bills[104].id,
    );
    const tied = await request(
      "/accounts-payable/bills?sort=totalAmount&order=asc&limit=100",
      token,
    );
    assert.deepEqual(
      tied.items.map((bill) => bill.id),
      [...bills]
        .map((bill) => bill.id)
        .sort()
        .slice(0, 100),
    );
    const historyPath = `/accounts-payable/bills/${bills[0].id}/payments`;
    const history = await request(`${historyPath}?paginated=true&limit=10&offset=20`, token);
    assert.equal(history.total, 25);
    assert.equal(history.items.length, 5);
    assert.equal(typeof history.items[0].amount, "string");
    const reversed = await request(`${historyPath}?paginated=true&reversalState=REVERSED`, token);
    assert.equal(reversed.total, 1);
    assert.equal(reversed.items[0].reversalReason, "Correction");
    const ordered = await request(`${historyPath}?paginated=true&limit=100&order=desc`, token);
    assert.deepEqual(
      ordered.items.map((row) => row.id),
      ordered.items.map((row) => row.id).sort(),
    );
    assert.equal((await request(`${historyPath}?paginated=true&method=CASH`, token)).total, 12);
    assert.equal((await request(`${historyPath}?paginated=true`, other.accessToken)).total, 0);
    assert.ok(
      Array.isArray(await request(historyPath, token)),
      "legacy unqueried response remains an array",
    );
    const detail = await request(
      `/accounts-payable/bills/${bills[0].id}?includeHistory=false`,
      token,
    );
    assert.deepEqual(detail.payments, []);
    assert.equal(detail.balance, "7.60");
    const settlement = await request(
      `/expenses/${expenses[0].id}/settlement?includeHistory=false`,
      token,
    );
    assert.equal(settlement.balance, "7.60");
    assert.deepEqual(settlement.payments, []);
    const expensePage = await request("/expenses?limit=10&offset=10&sort=title&order=asc", token);
    assert.equal(expensePage.total, 21);
    assert.equal(expensePage.items.length, 10);
    assert.equal(expensePage.items[0].title, "Expense 010");
    assert.equal(
      (await request("/expenses?settlementStatus=PARTIALLY_PAID", token)).items[0].id,
      expenses[0].id,
    );
    assert.equal((await request(`/expenses/${expenses[0].id}`, token)).settlement.balance, "7.60");
    const totals = await request("/accounts-payable/summary", token);
    await request("/accounts-payable/bills?limit=1&offset=100", token);
    assert.equal(totals.outstanding, "7.60");
    const compact = await request("/accounts-payable/summary?compact=true", token);
    assert.equal(compact.outstanding, totals.outstanding);
    assert.deepEqual(compact.vendorBalances, []);
    assert.deepEqual(await request("/accounts-payable/summary", token), totals);
    for (const path of [
      "/vendors?limit=101",
      "/vendors?offset=-1",
      "/vendors?sort=dueDate",
      "/accounts-payable/bills?sort=unsafe",
      "/accounts-payable/bills?from=2026-12-02&to=2026-12-01",
      "/expenses?from=2026-99-99",
      `${historyPath}?paginated=true&method=INVALID`,
    ])
      await request(path, token, undefined, 400);
  } finally {
    await app.close();
  }
});
