import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { Temporal } from "temporal-polyfill";
import { createApplication } from "../dist/src/app.factory.js";
import { DATABASE } from "../dist/src/infrastructure/database/database.module.js";

test("cash flow API enforces tenant ownership, RBAC, balances and optimistic updates", async () => {
  assert.match(new URL(process.env.DATABASE_URL).pathname, /^\/puffinpal_auth_test_/);
  const app = await createApplication(true);
  await app.listen(0, "127.0.0.1");
  const base = `${await app.getUrl()}/api/v1`;
  const db = app.get(DATABASE);
  async function request(path, token, body, method = "POST", expected = 200) {
    const response = await fetch(base + path, {
      method,
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const value = await response.json();
    assert.equal(response.status, expected, JSON.stringify(value));
    return value;
  }
  try {
    const password = "Cash-flow-test-password-123";
    const signup = (slug, email) =>
      request(
        "/auth/signup",
        null,
        { organizationName: slug, organizationSlug: slug, fullName: "Owner", email, password },
        "POST",
        201,
      );
    const owner = await signup("cash-flow-owner", "owner@cash-flow.test");
    const other = await signup("cash-flow-other", "other@cash-flow.test");
    const token = owner.accessToken;
    const today = Temporal.Now.plainDateISO("UTC");
    const due = today.add({ days: 2 });
    const client = await db.orm.public.Client.create({
      organizationId: owner.organization.id,
      name: "Forecast client",
      email: "forecast@example.test",
    });
    const invoice = await db.orm.public.Invoice.create({
      organizationId: owner.organization.id,
      clientId: client.id,
      invoiceNumber: "FORECAST-1",
      status: "ISSUED",
      issueDate: Temporal.Instant.from(`${today}T00:00:00Z`),
      dueDate: Temporal.Instant.from(`${due}T00:00:00Z`),
      subtotal: "100.00",
      tax: "0.00",
      total: "100.00",
      currency: owner.organization.currency,
    });
    await db.orm.public.Payment.create({
      organizationId: owner.organization.id,
      invoiceId: invoice.id,
      amount: "25.00",
      paymentDate: Temporal.Instant.from(`${today}T00:00:00Z`),
      method: "BANK_TRANSFER",
      recordedByUserId: owner.user.id,
    });

    const initial = await request("/cash-flow/configuration", token, undefined, "GET");
    assert.equal(initial.version, 0);
    const configured = await request(
      "/cash-flow/configuration",
      token,
      {
        expectedVersion: 0,
        openingBalance: "1000.00",
        openingBalanceDate: today.toString(),
        expectedInvoiceCollectionDelay: 0,
      },
      "PATCH",
    );
    assert.equal(configured.version, 1);
    const forecast = await request(
      "/cash-flow/forecast?horizonDays=30&scenario=EXPECTED",
      token,
      undefined,
      "GET",
    );
    assert.equal(forecast.summary.projectedInflows, "75.00");
    assert.equal(forecast.summary.projectedClosingBalance, "1075.00");
    assert.equal(
      forecast.events.some((item) => item.label === "FORECAST-1"),
      true,
    );
    const otherForecast = await request(
      "/cash-flow/forecast?horizonDays=30",
      other.accessToken,
      undefined,
      "GET",
    );
    assert.equal(
      otherForecast.events.some((item) => item.label === "FORECAST-1"),
      false,
    );

    await request(
      "/members",
      token,
      { email: "viewer@cash-flow.test", fullName: "Viewer", password, role: "FINANCE_VIEWER" },
      "POST",
      201,
    );
    const viewer = await request(
      "/auth/login",
      null,
      { organizationSlug: "cash-flow-owner", email: "viewer@cash-flow.test", password },
      "POST",
    );
    await request("/cash-flow/forecast?horizonDays=30", viewer.accessToken, undefined, "GET");
    await request(
      "/cash-flow/configuration",
      viewer.accessToken,
      { expectedVersion: 1, defaultHorizonDays: 60 },
      "PATCH",
      403,
    );

    const update = () =>
      fetch(`${base}/cash-flow/configuration`, {
        method: "PATCH",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ expectedVersion: 1, defaultHorizonDays: 60 }),
      });
    const concurrent = await Promise.all([update(), update()]);
    assert.deepEqual(concurrent.map((response) => response.status).sort(), [200, 409]);
    const audits = await db.orm.public.CashFlowForecastAuditEvent.where({
      organizationId: owner.organization.id,
    }).all();
    assert.equal(audits.length, 2);
  } finally {
    await app.close();
  }
});
