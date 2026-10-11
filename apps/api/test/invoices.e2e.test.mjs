import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { createApplication } from "../dist/src/app.factory.js";
import { DATABASE } from "../dist/src/database.module.js";
const password = "Invoice-test-password-123";
test("draft invoice creation: calculations, isolation, permissions, concurrency and rollback", async (t) => {
  const url = new URL(process.env.DATABASE_URL);
  assert.match(url.pathname, /^\/puffinpal_auth_test_/);
  const app = await createApplication(true);
  await app.listen(0, "127.0.0.1");
  const db = app.get(DATABASE);
  const base = `${await app.getUrl()}/api/v1`;
  async function request(path, token, body, method = "POST") {
    const response = await fetch(base + path, {
      method,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
  }
  async function expect(path, token, body, status, method) {
    const response = await request(path, token, body, method);
    assert.equal(response.status, status, JSON.stringify(response.body));
    return response.body;
  }
  try {
    const signup = async (slug) =>
      expect(
        "/auth/signup",
        null,
        {
          organizationName: slug,
          organizationSlug: slug,
          fullName: "Owner",
          email: "invoice-owner@example.test",
          password,
        },
        201,
      );
    const a = await signup("invoice-a");
    const b = await signup("invoice-b");
    const client = await expect(
      "/clients",
      a.accessToken,
      { name: "Client A", email: "invoice-client-a@example.test" },
      201,
    );
    const otherClient = await expect(
      "/clients",
      b.accessToken,
      { name: "Client B", email: "invoice-client-b@example.test" },
      201,
    );
    const input = {
      clientId: client.id,
      issueDate: "2026-10-10",
      dueDate: "2026-11-10",
      notes: "Draft only",
      items: [
        { description: "First", quantity: 3, unitPrice: "0.10" },
        { description: "Second", quantity: 2, unitPrice: "12.25" },
      ],
    };
    await t.test(
      "multiple items are persisted with exact server-calculated totals",
      async () => {
        const invoice = await expect("/invoices", a.accessToken, input, 201);
        assert.equal(invoice.status, "DRAFT");
        assert.equal(invoice.organizationId, a.organization.id);
        assert.equal(invoice.subtotal, "24.80");
        assert.equal(invoice.tax, "0.00");
        assert.equal(invoice.total, "24.80");
        assert.equal(invoice.notes, input.notes);
        assert.equal(invoice.items.length, 2);
        assert.deepEqual(
          invoice.items.map((row) => row.amount),
          ["0.30", "24.50"],
        );
        for (const item of invoice.items) {
          assert.equal(item.invoiceId, invoice.id);
          assert.equal(item.organizationId, a.organization.id);
        }
        const items = await expect(
          `/invoices/${invoice.id}/items`,
          a.accessToken,
          undefined,
          200,
          "GET",
        );
        assert.equal(items.length, 2);
      },
    );
    await t.test(
      "invalid inputs and supplied financial or tenant fields are rejected",
      async () => {
        for (const patch of [
          { clientId: "invalid" },
          { items: [] },
          { items: [null] },
          { items: [{ description: " ", quantity: 1, unitPrice: "1.00" }] },
          { items: [{ description: "Work", quantity: 0, unitPrice: "1.00" }] },
          {
            items: [{ description: "Work", quantity: 1.5, unitPrice: "1.00" }],
          },
          { items: [{ description: "Work", quantity: 1, unitPrice: "-1.00" }] },
          { items: [{ description: "Work", quantity: 1, unitPrice: "0.001" }] },
          { items: [{ description: "Work", quantity: 1, unitPrice: 0.1 }] },
          { dueDate: "2026-10-09" },
          { issueDate: "2026-02-30" },
          { total: "0.00" },
          { organizationId: b.organization.id },
          { status: "PAID" },
          { currency: "EUR" },
          {
            items: [
              { description: "Work", quantity: 2, unitPrice: "9999999999.99" },
            ],
          },
        ])
          await expect("/invoices", a.accessToken, { ...input, ...patch }, 400);
        await expect(
          "/invoices",
          a.accessToken,
          { ...input, clientId: randomUUID() },
          404,
        );
        await expect(
          "/invoices",
          a.accessToken,
          { ...input, clientId: otherClient.id },
          404,
        );
      },
    );
    await t.test(
      "authentication and invoice permissions are enforced",
      async () => {
        await expect("/invoices", null, input, 401);
        for (const role of ["ADMIN", "PROJECT_MANAGER", "FINANCE_VIEWER"]) {
          const email = `${role.toLowerCase()}@invoices.test`;
          await expect(
            "/members",
            a.accessToken,
            { email, fullName: role, password, role },
            201,
          );
          const session = await expect(
            "/auth/login",
            null,
            { organizationSlug: "invoice-a", email, password },
            200,
          );
          await expect(
            "/invoices",
            session.accessToken,
            input,
            role === "FINANCE_VIEWER" ? 403 : 201,
          );
        }
      },
    );
    await t.test(
      "simultaneous requests produce unique numbers and correctly linked items",
      async () => {
        const invoices = await Promise.all(
          Array.from({ length: 12 }, () =>
            expect("/invoices", a.accessToken, input, 201),
          ),
        );
        assert.equal(
          new Set(invoices.map((invoice) => invoice.invoiceNumber)).size,
          12,
        );
        for (const invoice of invoices) {
          assert.match(invoice.invoiceNumber, /^INV-[a-f0-9-]{36}$/);
          assert.ok(
            invoice.items.every((item) => item.invoiceId === invoice.id),
          );
        }
        const own = await expect(
          "/invoices",
          b.accessToken,
          { ...input, clientId: otherClient.id },
          201,
        );
        assert.equal(own.organizationId, b.organization.id);
      },
    );
    await t.test(
      "failure on the second line item rolls back the invoice and the first item",
      async () => {
        const beforeInvoices = await db.orm.public.Invoice.where({
          organizationId: a.organization.id,
        })
          .select("id")
          .all();
        const beforeItems = await db.orm.public.InvoiceItem.where({
          organizationId: a.organization.id,
        })
          .select("id")
          .all();
        // A throwaway database trigger forces a real mid-transaction DB failure.
        const sql = `CREATE FUNCTION fail_invoice_test_item() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.description = '__force_item_failure__' THEN RAISE EXCEPTION 'Test line item failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER invoice_test_item_failure BEFORE INSERT ON invoice_items FOR EACH ROW EXECUTE FUNCTION fail_invoice_test_item();`;
        const setup = spawnSync(
          "docker",
          [
            "exec",
            "puffinpal-postgres",
            "psql",
            "-U",
            decodeURIComponent(url.username),
            "-d",
            url.pathname.slice(1),
            "-v",
            "ON_ERROR_STOP=1",
            "-c",
            sql,
          ],
          { encoding: "utf8" },
        );
        assert.equal(setup.status, 0, setup.stderr);
        await expect(
          "/invoices",
          a.accessToken,
          {
            ...input,
            items: [
              ...input.items.slice(0, 1),
              {
                description: "__force_item_failure__",
                quantity: 1,
                unitPrice: "1.00",
              },
            ],
          },
          500,
        );
        assert.equal(
          (
            await db.orm.public.Invoice.where({
              organizationId: a.organization.id,
            })
              .select("id")
              .all()
          ).length,
          beforeInvoices.length,
        );
        assert.equal(
          (
            await db.orm.public.InvoiceItem.where({
              organizationId: a.organization.id,
            })
              .select("id")
              .all()
          ).length,
          beforeItems.length,
        );
      },
    );
  } finally {
    await app.close();
  }
});
