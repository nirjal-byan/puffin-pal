import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { createApplication } from "../dist/src/app.factory.js";
import { DATABASE } from "../dist/src/database.module.js";

test("invoice payment tracking", async (t) => {
  const url = new URL(process.env.DATABASE_URL);
  assert.match(url.pathname, /^\/puffinpal_auth_test_/);
  const app = await createApplication(true);
  await app.listen(0, "127.0.0.1");
  const base = `${await app.getUrl()}/api/v1`;
  const db = app.get(DATABASE);
  async function request(path, token, body, method = "POST", status = 201) {
    const response = await fetch(base + path, { method, headers: {
      "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}),
    }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const value = await response.json();
    if (status !== null) assert.equal(response.status, status, JSON.stringify(value));
    return { status: response.status, body: value };
  }
  const sql = (statement) => {
    const result = spawnSync("docker", ["exec", "puffinpal-postgres", "psql", "-U", decodeURIComponent(url.username), "-d", url.pathname.slice(1), "-v", "ON_ERROR_STOP=1", "-c", statement], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
  };
  try {
    const password = "Payment-test-password-123";
    const signup = async (slug) => (await request("/auth/signup", null, {
      organizationName: slug, organizationSlug: slug, fullName: "Payment Owner", email: "owner@payment.test", password,
    })).body;
    const owner = await signup("payment-owner");
    const other = await signup("payment-other");
    const token = owner.accessToken;
    const client = (await request("/clients", token, { name: "Payment Client", email: "client@payment.test" })).body;
    const create = async (extra = {}, issue = true) => {
      const draft = (await request("/invoices", token, { clientId: client.id, issueDate: "2020-01-01", dueDate: "2099-01-01", items: [{ description: "Service", quantity: 3, unitPrice: "0.10" }], ...extra })).body;
      return issue ? (await request(`/invoices/${draft.id}/issue`, token, { expectedVersion: draft.version }, "POST", 200)).body : draft;
    };
    const detail = async (id, auth = token) => (await request(`/invoices/${id}`, auth, undefined, "GET", 200)).body;
    const payload = (amount, expectedVersion = 2) => ({ amount, expectedVersion, paymentDate: "2026-01-01", method: "BANK_TRANSFER", reference: "REF-123", notes: "Received" });
    const pay = (invoice, amount, expectedVersion = invoice.version, auth = token, status = 201) => request(`/invoices/${invoice.id}/payments`, auth, payload(amount, expectedVersion), "POST", status);

    await t.test("full and partial payments, history, duplicate rejection and paid PDF", async () => {
      const invoice = await create();
      const partial = (await pay(invoice, "0.10")).body;
      assert.equal(partial.status, "ISSUED");
      assert.equal(partial.totalPaid, "0.10");
      assert.equal(partial.outstandingBalance, "0.20");
      assert.equal(partial.version, 3);
      assert.equal(partial.payments[0].reference, "REF-123");
      assert.equal(partial.payments[0].notes, "Received");
      assert.equal(partial.payments[0].recordedByUserId, owner.user.id);
      await pay(invoice, "0.10", 2, token, 409);
      await pay(partial, "0.21", 3, token, 409);
      const paid = (await pay(partial, "0.20")).body;
      assert.equal(paid.status, "PAID");
      assert.equal(paid.totalPaid, "0.30");
      assert.equal(paid.outstandingBalance, "0.00");
      assert.equal(paid.payments.length, 2);
      for (const key of ["items", "total", "invoiceNumber", "issuedAt", "sellerName", "billingName"]) assert.deepEqual(paid[key], invoice[key]);
      await pay(paid, "0.01", paid.version, token, 409);
      await request(`/invoices/${invoice.id}`, token, { expectedVersion: paid.version }, "DELETE", 409);
      const pdf = await fetch(`${base}/invoices/${invoice.id}/pdf`, { headers: { authorization: `Bearer ${token}` } });
      assert.equal(pdf.status, 200);
      assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString(), "%PDF-");
    });
    await t.test("permissions, tenant isolation and unissued/cancelled rejection", async () => {
      const invoice = await create();
      await pay(invoice, "0.10", 2, null, 401);
      await pay(invoice, "0.10", 2, other.accessToken, 404);
      await request(`/invoices/${invoice.id}`, other.accessToken, undefined, "GET", 404);
      for (const role of ["ADMIN", "PROJECT_MANAGER", "FINANCE_VIEWER"]) {
        const email = `${role.toLowerCase()}@payment.test`;
        await request("/members", token, { email, fullName: role, role, password });
        const member = (await request("/auth/login", null, { organizationSlug: "payment-owner", email, password }, "POST", 200)).body;
        const ownInvoice = await create();
        await pay(ownInvoice, "0.10", 2, member.accessToken, role === "ADMIN" ? 201 : 403);
        assert.ok(Array.isArray((await detail(ownInvoice.id, member.accessToken)).payments));
      }
      const draft = await create({}, false);
      await pay(draft, "0.10", draft.version, token, 409);
      await db.orm.public.Invoice.where({ id: invoice.id, organizationId: owner.organization.id }).update({ status: "CANCELLED" });
      await pay(invoice, "0.10", 2, token, 409);
      assert.equal((await detail(invoice.id)).payments.length, 0);
    });
    await t.test("invalid values are rejected without adding payments", async () => {
      const invoice = await create();
      for (const amount of ["0", "-1", "1.001", "1e2", "10000000000", 1])
        await pay(invoice, amount, 2, token, 400);
      for (const extra of [{ organizationId: other.organization.id }, { status: "PAID" }, { totalPaid: "1" }, { paymentDate: "2999-01-01" }, { paymentDate: "2026-02-30" }])
        await request(`/invoices/${invoice.id}/payments`, token, { ...payload("0.10"), ...extra }, "POST", 400);
      assert.equal((await detail(invoice.id)).payments.length, 0);
    });
    await t.test("concurrent payments serialize and cannot overpay", async () => {
      const invoice = await create();
      const results = await Promise.all([pay(invoice, "0.20", 2, token, null), pay(invoice, "0.20", 2, token, null)]);
      assert.deepEqual(results.map((result) => result.status).sort(), [201, 409]);
      const current = await detail(invoice.id);
      assert.equal(current.payments.length, 1);
      assert.equal(current.totalPaid, "0.20");
      assert.equal(current.outstandingBalance, "0.10");
    });
    await t.test("overdue is derived in detail/list without storing OVERDUE", async () => {
      const invoice = await create({ dueDate: "2020-02-01" });
      const current = await detail(invoice.id);
      assert.equal(current.status, "ISSUED");
      assert.equal(current.displayStatus, "OVERDUE");
      const rows = (await request("/invoices?limit=100", token, undefined, "GET", 200)).body;
      assert.equal(rows.find((row) => row.id === invoice.id).isOverdue, true);
      const paid = (await pay(invoice, "0.30")).body;
      assert.equal(paid.displayStatus, "PAID");
      assert.equal(paid.isOverdue, false);
    });
    await t.test("transaction rolls back payment insertion if invoice update fails", async () => {
      const invoice = await create({ notes: "payment rollback test" });
      sql(`CREATE FUNCTION payment_test_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.notes = 'payment rollback test' THEN RAISE EXCEPTION 'Intentional payment rollback'; END IF; RETURN NEW; END; $$;
        CREATE TRIGGER payment_test_failure BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION payment_test_failure();`);
      try {
        await pay(invoice, "0.10", 2, token, 500);
        const current = await detail(invoice.id);
        assert.equal(current.payments.length, 0);
        assert.equal(current.version, 2);
        assert.equal(current.totalPaid, "0.00");
      } finally { sql("DROP TRIGGER payment_test_failure ON invoices; DROP FUNCTION payment_test_failure();"); }
    });
    await t.test("payment foreign keys prohibit invoice deletion and cross-tenant relationships", async () => {
      const invoice = await create();
      await pay(invoice, "0.10");
      await assert.rejects(db.orm.public.Invoice.where({ organizationId: owner.organization.id, id: invoice.id }).delete());
      const payment = (await detail(invoice.id)).payments[0];
      await assert.rejects(db.orm.public.Payment.where({ id: payment.id }).update({ organizationId: other.organization.id }));
    });
  } finally { await app.close(); }
});
