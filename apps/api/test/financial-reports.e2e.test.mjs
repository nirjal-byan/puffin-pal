import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { Temporal } from "temporal-polyfill";
import { createApplication } from "../dist/src/app.factory.js";
import { DATABASE } from "../dist/src/infrastructure/database/database.module.js";

test("financial reports aggregate authoritative tenant records without cross-tenant leakage", async () => {
  assert.match(new URL(process.env.DATABASE_URL).pathname, /^\/puffinpal_auth_test_/);
  const app = await createApplication(true);
  await app.listen(0, "127.0.0.1");
  const base = `${await app.getUrl()}/api/v1`;
  const db = app.get(DATABASE);
  async function request(path, token, body, method = "POST", expected = 200) {
    const response = await fetch(base + path, {
      method,
      headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { "content-type": "application/json" }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const value = await response.json();
    assert.equal(response.status, expected, JSON.stringify(value));
    return value;
  }
  try {
    const password = "Financial-report-password-123";
    const owner = await request("/auth/signup", null, { organizationName: "Reports", organizationSlug: "reports-owner", fullName: "Owner", email: "owner@reports.test", password }, "POST", 201);
    const other = await request("/auth/signup", null, { organizationName: "Other", organizationSlug: "reports-other", fullName: "Other", email: "other@reports.test", password }, "POST", 201);
    const day = Temporal.PlainDate.from("2026-06-15");
    const instant = Temporal.Instant.from(`${day}T00:00:00Z`);
    const client = await db.orm.public.Client.create({ organizationId: owner.organization.id, name: "Report client", email: "client@reports.test" });
    const invoice = await db.orm.public.Invoice.create({ organizationId: owner.organization.id, clientId: client.id, invoiceNumber: "REPORT-1", status: "ISSUED", issueDate: instant, dueDate: Temporal.Instant.from("2026-06-20T00:00:00Z"), issuedAt: instant, subtotal: "100.00", tax: "0.00", total: "100.00", currency: "USD" });
    await db.orm.public.Payment.create({ organizationId: owner.organization.id, invoiceId: invoice.id, amount: "25.00", paymentDate: instant, method: "BANK_TRANSFER", recordedByUserId: owner.user.id });
    await db.orm.public.Expense.create({ organizationId: owner.organization.id, title: "Approved cost", amount: "10.00", category: "SOFTWARE", date: instant, approvalStatus: "APPROVED", createdByUserId: owner.user.id });
    await db.orm.public.Expense.create({ organizationId: owner.organization.id, title: "Rejected cost", amount: "99.00", category: "OTHER", date: instant, approvalStatus: "REJECTED", createdByUserId: owner.user.id });
    const query = "from=2026-06-01&to=2026-06-30&currency=USD&groupBy=month";
    const report = await request(`/financial-reports/overview?${query}`, owner.accessToken, undefined, "GET");
    assert.equal(report.revenue.issued, "100.00");
    assert.equal(report.revenue.collected, "25.00");
    assert.equal(report.revenue.outstanding, "75.00");
    assert.equal(report.expenses.approved, "10.00");
    assert.equal(report.profitability.profit, "90.00");
    assert.equal(report.payables.available, false);
    const isolated = await request(`/financial-reports/overview?${query}`, other.accessToken, undefined, "GET");
    assert.equal(isolated.revenue.issued, "0.00");
    assert.equal(isolated.expenses.approved, "0.00");
  } finally {
    await app.close();
  }
});
