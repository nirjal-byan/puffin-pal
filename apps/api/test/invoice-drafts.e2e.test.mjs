import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { createApplication } from "../dist/src/app.factory.js";
import { DATABASE } from "../dist/src/infrastructure/database/database.module.js";

test("invoice details, draft editing, safe deletion and concurrency", async (t) => {
  const url = new URL(process.env.DATABASE_URL);
  assert.match(url.pathname, /^\/puffinpal_auth_test_/);
  const app = await createApplication(true);
  await app.listen(0, "127.0.0.1");
  const db = app.get(DATABASE);
  const base = `${await app.getUrl()}/api/v1`;
  const password = "Draft-test-password-123";
  async function request(path, token, body, method = "GET") {
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
    const result = await request(path, token, body, method);
    assert.equal(
      result.status,
      status,
      `${method} ${path}: ${JSON.stringify(result.body)}`,
    );
    return result.body;
  }
  function sql(statement) {
    const result = spawnSync(
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
        statement,
      ],
      { encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
  }
  try {
    const signup = (slug) =>
      expect(
        "/auth/signup",
        null,
        {
          organizationName: slug,
          organizationSlug: slug,
          fullName: "Owner",
          email: "owner@drafts.test",
          password,
        },
        201,
        "POST",
      );
    const a = await signup("draft-a");
    const b = await signup("draft-b");
    const token = a.accessToken;
    const client = await expect(
      "/clients",
      token,
      { name: "Client A", email: "a@drafts.test" },
      201,
      "POST",
    );
    const otherClient = await expect(
      "/clients",
      b.accessToken,
      { name: "Client B", email: "b@drafts.test" },
      201,
      "POST",
    );
    const client2 = await expect(
      "/clients",
      token,
      { name: "Changed client", email: "a2@drafts.test" },
      201,
      "POST",
    );
    const input = {
      clientId: client.id,
      issueDate: "2026-10-10",
      dueDate: "2026-11-10",
      notes: "Original",
      items: [
        { description: "First", quantity: 3, unitPrice: "0.10" },
        { description: "Second", quantity: 2, unitPrice: "12.25" },
      ],
    };
    const create = () => expect("/invoices", token, input, 201, "POST");
    const detail = (id) => expect(`/invoices/${id}`, token, undefined, 200);
    const edit = (id, patch = {}, version = 1) =>
      expect(
        `/invoices/${id}`,
        token,
        { ...input, ...patch, expectedVersion: version },
        200,
        "PATCH",
      );
    const roles = {};
    for (const role of ["ADMIN", "PROJECT_MANAGER", "FINANCE_VIEWER"]) {
      const email = `${role.toLowerCase()}@drafts.test`;
      await expect(
        "/members",
        token,
        { email, fullName: role, password, role },
        201,
        "POST",
      );
      roles[role] = (
        await expect(
          "/auth/login",
          null,
          { organizationSlug: "draft-a", email, password },
          200,
          "POST",
        )
      ).accessToken;
    }
    await t.test(
      "detail returns scoped client, decimal strings and entry-ordered items",
      async () => {
        const invoice = await create();
        const value = await detail(invoice.id);
        assert.equal(value.version, 1);
        assert.equal(value.client.id, client.id);
        assert.deepEqual(
          Object.keys(value.client).sort(),
          ["id", "name", "email", "companyName", "taxId"].sort(),
        );
        assert.equal(value.total, "24.80");
        assert.deepEqual(
          value.items.map((i) => i.description),
          ["First", "Second"],
        );
        assert.deepEqual(
          value.items.map((i) => i.position),
          [0, 1],
        );
        assert.doesNotMatch(JSON.stringify(value), /passwordHash/);
        await expect(`/invoices/${invoice.id}`, b.accessToken, undefined, 404);
        await expect(`/invoices/${randomUUID()}`, token, undefined, 404);
        await expect("/invoices/invalid", token, undefined, 400);
        for (const method of ["PATCH", "DELETE"]) {
          await expect(
            `/invoices/${invoice.id}`,
            null,
            { ...input, expectedVersion: 1 },
            401,
            method,
          );
        }
        await expect(`/invoices/${invoice.id}`, null, undefined, 401);
        await expect(
          `/invoices/${invoice.id}`,
          b.accessToken,
          { ...input, clientId: otherClient.id, expectedVersion: 1 },
          404,
          "PATCH",
        );
        await expect(
          `/invoices/${invoice.id}`,
          b.accessToken,
          { expectedVersion: 1 },
          404,
          "DELETE",
        );
      },
    );
    await t.test(
      "editing replaces items, preserves identity, recalculates exactly and clears notes",
      async () => {
        const invoice = await create();
        const result = await edit(invoice.id, {
          clientId: client2.id,
          notes: "",
          items: [{ description: "Updated", quantity: 7, unitPrice: "0.10" }],
        });
        assert.equal(result.id, invoice.id);
        assert.equal(result.invoiceNumber, invoice.invoiceNumber);
        assert.equal(result.version, 2);
        assert.equal(result.notes, null);
        assert.equal(result.client.id, client2.id);
        assert.equal(result.subtotal, "0.70");
        assert.equal(result.total, "0.70");
        assert.equal(result.tax, "0.00");
        assert.equal(result.items.length, 1);
        assert.ok(!invoice.items.some((i) => i.id === result.items[0].id));
        const withoutNotes = { ...input, expectedVersion: 2 };
        delete withoutNotes.notes;
        const preserved = await expect(
          `/invoices/${invoice.id}`,
          token,
          withoutNotes,
          200,
          "PATCH",
        );
        assert.equal(preserved.notes, null);
        assert.deepEqual(
          (await detail(invoice.id)).items.map((i) => i.description),
          ["First", "Second"],
        );
      },
    );
    await t.test(
      "patch validates client, dates, lines, version and rejects server-owned fields",
      async () => {
        const invoice = await create();
        for (const patch of [
          { expectedVersion: undefined },
          { expectedVersion: "1" },
          { expectedVersion: 0 },
          { expectedVersion: 1.5 },
          { notes: null },
          { items: [] },
          { dueDate: "2026-01-01" },
          { issueDate: "2026-02-30" },
          { items: [{ description: "A", quantity: 0, unitPrice: "0.10" }] },
          { items: [{ description: "A", quantity: 1, unitPrice: "0.001" }] },
          { total: "0.00" },
          { organizationId: b.organization.id },
          { status: "PAID" },
          { version: 8 },
        ]) {
          await expect(
            `/invoices/${invoice.id}`,
            token,
            { ...input, expectedVersion: 1, ...patch },
            400,
            "PATCH",
          );
        }
        for (const clientId of [otherClient.id, randomUUID()])
          await expect(
            `/invoices/${invoice.id}`,
            token,
            { ...input, clientId, expectedVersion: 1 },
            404,
            "PATCH",
          );
        await expect(`/invoices/${invoice.id}`, token, {}, 400, "DELETE");
        assert.equal((await detail(invoice.id)).version, 1);
      },
    );
    await t.test(
      "all roles can read; only permitted roles edit and delete",
      async () => {
        for (const [role, memberToken] of Object.entries(roles)) {
          const invoice = await create();
          await expect(`/invoices/${invoice.id}`, memberToken, undefined, 200);
          await expect(
            `/invoices/${invoice.id}`,
            memberToken,
            { ...input, expectedVersion: 1 },
            role === "FINANCE_VIEWER" ? 403 : 200,
            "PATCH",
          );
          await expect(
            `/invoices/${invoice.id}`,
            memberToken,
            { expectedVersion: role === "FINANCE_VIEWER" ? 1 : 2 },
            role === "ADMIN" ? 200 : 403,
            "DELETE",
          );
        }
      },
    );
    await t.test(
      "every non-draft status rejects edit and deletion",
      async () => {
        for (const status of ["PENDING", "PAID", "OVERDUE", "CANCELLED"]) {
          const invoice = await create();
          await db.orm.public.Invoice.where({
            organizationId: a.organization.id,
            id: invoice.id,
          }).updateAll({ status });
          await expect(
            `/invoices/${invoice.id}`,
            token,
            { ...input, expectedVersion: 1 },
            409,
            "PATCH",
          );
          await expect(
            `/invoices/${invoice.id}`,
            token,
            { expectedVersion: 1 },
            409,
            "DELETE",
          );
          assert.equal((await detail(invoice.id)).status, status);
        }
      },
    );
    await t.test(
      "stale edits and deletion fail; current draft deletion cascades items",
      async () => {
        const invoice = await create();
        await edit(invoice.id);
        await expect(
          `/invoices/${invoice.id}`,
          token,
          { ...input, expectedVersion: 1 },
          409,
          "PATCH",
        );
        await expect(
          `/invoices/${invoice.id}`,
          token,
          { expectedVersion: 1 },
          409,
          "DELETE",
        );
        await expect(
          `/invoices/${invoice.id}`,
          token,
          { expectedVersion: 2 },
          200,
          "DELETE",
        );
        await expect(`/invoices/${invoice.id}`, token, undefined, 404);
        assert.equal(
          (
            await db.orm.public.InvoiceItem.where({
              organizationId: a.organization.id,
              invoiceId: invoice.id,
            }).all()
          ).length,
          0,
        );
        await expect(
          `/invoices/${invoice.id}`,
          token,
          { expectedVersion: 2 },
          404,
          "DELETE",
        );
      },
    );
    await t.test(
      "simultaneous edits and edit/delete races have only one winner",
      async () => {
        // Delay the winner while it holds the row lock to exercise DB predicate
        // re-evaluation, not just rejection after an already completed request.
        sql(
          `CREATE FUNCTION slow_draft_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_sleep(0.1); RETURN NEW; END $$; CREATE TRIGGER slow_draft_update BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION slow_draft_update();`,
        );
        for (let run = 0; run < 3; run++) {
          const invoice = await create();
          const results = await Promise.all(
            ["One", "Two"].map((notes) =>
              request(
                `/invoices/${invoice.id}`,
                token,
                { ...input, notes, expectedVersion: 1 },
                "PATCH",
              ),
            ),
          );
          assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
          const value = await detail(invoice.id);
          assert.equal(value.version, 2);
          assert.equal(
            value.notes,
            results.find((r) => r.status === 200).body.notes,
          );
          const raced = await create();
          const competing = await Promise.all([
            request(
              `/invoices/${raced.id}`,
              token,
              { ...input, expectedVersion: 1 },
              "PATCH",
            ),
            request(
              `/invoices/${raced.id}`,
              token,
              { expectedVersion: 1 },
              "DELETE",
            ),
          ]);
          assert.equal(competing.filter((r) => r.status === 200).length, 1);
          assert.ok(competing.every((r) => [200, 404, 409].includes(r.status)));
        }
      },
    );
    await t.test(
      "a concurrent status change blocks draft mutation even without a version bump",
      async () => {
        for (const method of ["PATCH", "DELETE"]) {
          const invoice = await create();
          let pending;
          await db.transaction(async (tx) => {
            await tx.orm.public.Invoice.where({
              organizationId: a.organization.id,
              id: invoice.id,
            }).updateAll({ status: "PAID" });
            pending = request(
              `/invoices/${invoice.id}`,
              token,
              method === "PATCH"
                ? { ...input, expectedVersion: 1 }
                : { expectedVersion: 1 },
              method,
            );
            // Let the request read the previously committed DRAFT, then wait for
            // our row lock. The SQL status predicate must be rechecked on release.
            await new Promise((resolve) => setTimeout(resolve, 150));
          });
          assert.equal((await pending).status, 409);
          assert.equal((await detail(invoice.id)).status, "PAID");
        }
      },
    );
    await t.test(
      "failed replacement rolls back header, version and original items",
      async () => {
        const invoice = await create();
        const before = await detail(invoice.id);
        sql(
          `CREATE FUNCTION fail_draft_replacement() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.description = '__fail_draft__' THEN RAISE EXCEPTION 'Draft test failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER fail_draft_replacement BEFORE INSERT ON invoice_items FOR EACH ROW EXECUTE FUNCTION fail_draft_replacement();`,
        );
        await expect(
          `/invoices/${invoice.id}`,
          token,
          {
            ...input,
            notes: "Changed",
            expectedVersion: 1,
            items: [
              input.items[0],
              { description: "__fail_draft__", quantity: 1, unitPrice: "0.10" },
            ],
          },
          500,
          "PATCH",
        );
        assert.deepEqual(await detail(invoice.id), before);
      },
    );
    await t.test(
      "failed cascading delete rolls back invoice and items",
      async () => {
        const invoice = await create();
        const before = await detail(invoice.id);
        sql(
          `CREATE FUNCTION fail_draft_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Delete test failure'; END $$; CREATE TRIGGER fail_draft_delete BEFORE DELETE ON invoice_items FOR EACH ROW EXECUTE FUNCTION fail_draft_delete();`,
        );
        await expect(
          `/invoices/${invoice.id}`,
          token,
          { expectedVersion: 1 },
          500,
          "DELETE",
        );
        assert.deepEqual(await detail(invoice.id), before);
      },
    );
  } finally {
    await app.close();
  }
});
