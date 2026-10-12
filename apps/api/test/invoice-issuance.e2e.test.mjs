import "reflect-metadata";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { createApplication } from "../dist/src/app.factory.js";
import { DATABASE } from "../dist/src/database.module.js";

// This suite only runs against the disposable database owned by the runner.
test("invoice issuance", async (t) => {
  const url = new URL(process.env.DATABASE_URL);
  assert.match(url.pathname, /^\/puffinpal_auth_test_/);
  const app = await createApplication(true);
  await app.listen(0, "127.0.0.1");
  const db = app.get(DATABASE);
  const base = `${await app.getUrl()}/api/v1`;
  const password = "Issuance-test-password-123";
  async function request(path, token, body, method = "POST", status = 200) {
    const response = await fetch(base + path, {
      method,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const result = await response.json();
    if (status !== null)
      assert.equal(response.status, status, JSON.stringify(result));
    return { status: response.status, body: result };
  }
  const sql = (statement) => {
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
  };
  try {
    const signup = async (slug) =>
      (
        await request(
          "/auth/signup",
          null,
          {
            organizationName: slug,
            organizationSlug: slug,
            fullName: "Owner",
            email: "owner@issuance.test",
            password,
          },
          "POST",
          201,
        )
      ).body;
    const owner = await signup("issue-a");
    const other = await signup("issue-b");
    const token = owner.accessToken;
    const client = (
      await request(
        "/clients",
        token,
        {
          name: "Original client",
          email: "client@issuance.test",
          companyName: "Original company",
          taxId: "TAX-1",
        },
        "POST",
        201,
      )
    ).body;
    const input = {
      clientId: client.id,
      issueDate: "2026-10-10",
      dueDate: "2026-11-10",
      notes: "Keep me",
      items: [{ description: "Work", quantity: 3, unitPrice: "0.10" }],
    };
    const create = async () =>
      (await request("/invoices", token, input, "POST", 201)).body;
    const detail = async (id) =>
      (await request(`/invoices/${id}`, token, undefined, "GET")).body;
    const issue = (id, expectedVersion = 1, auth = token, status = 200) =>
      request(
        `/invoices/${id}/issue`,
        auth,
        { expectedVersion },
        "POST",
        status,
      );

    await t.test("permissions, validation and tenant isolation", async () => {
      const draft = await create();
      await issue(draft.id, 1, null, 401);
      await issue(draft.id, 1, other.accessToken, 404);
      for (const role of ["ADMIN", "PROJECT_MANAGER", "FINANCE_VIEWER"]) {
        const email = `${role.toLowerCase()}@issuance.test`;
        await request(
          "/members",
          token,
          { email, fullName: role, password, role },
          "POST",
          201,
        );
        const member = (
          await request("/auth/login", null, {
            organizationSlug: "issue-a",
            email,
            password,
          })
        ).body;
        await issue(
          draft.id,
          1,
          member.accessToken,
          role === "ADMIN" ? 200 : 403,
        );
      }
      for (const body of [
        {},
        { expectedVersion: 0 },
        { expectedVersion: 1.5 },
        { expectedVersion: 2147483647 },
        { expectedVersion: 1, status: "ISSUED" },
        { expectedVersion: 1, organizationId: other.organization.id },
      ]) {
        await request(`/invoices/${draft.id}/issue`, token, body, "POST", 400);
      }
    });
    await t.test(
      "issuance preserves content, snapshots billing and blocks mutations",
      async () => {
        const draft = await create();
        const before = await detail(draft.id);
        const issued = (await issue(draft.id)).body;
        assert.equal(issued.status, "ISSUED");
        assert.equal(issued.version, 2);
        assert.ok(issued.issuedAt);
        assert.equal(issued.issuedByUserId, owner.user.id);
        assert.equal(issued.billingName, client.name);
        assert.equal(issued.billingEmail, client.email);
        assert.equal(issued.billingCompanyName, client.companyName);
        assert.equal(issued.billingTaxId, client.taxId);
        assert.equal(issued.sellerName, owner.organization.name);
        assert.equal(issued.currency, owner.organization.currency);
        for (const key of [
          "invoiceNumber",
          "issueDate",
          "dueDate",
          "subtotal",
          "tax",
          "total",
          "notes",
          "items",
        ])
          assert.deepEqual(issued[key], before[key]);
        await issue(draft.id, 1, token, 409);
        await issue(draft.id, 2, token, 409);
        await request(
          `/invoices/${draft.id}`,
          token,
          { ...input, expectedVersion: 2 },
          "PATCH",
          409,
        );
        await request(
          `/invoices/${draft.id}`,
          token,
          { expectedVersion: 2 },
          "DELETE",
          409,
        );
        await request(
          `/clients/${client.id}`,
          token,
          {
            name: "Changed client",
            email: "changed@issuance.test",
            companyName: "Changed company",
            taxId: "TAX-2",
          },
          "PATCH",
        );
        await db.orm.public.Organization.where({
          id: owner.organization.id,
        }).updateAll({ name: "Changed seller", currency: "EUR" });
        const after = await detail(draft.id);
        assert.equal(after.client.name, client.name);
        assert.equal(after.client.email, client.email);
        assert.equal(after.client.companyName, client.companyName);
        assert.equal(after.client.taxId, client.taxId);
        assert.equal(after.sellerName, owner.organization.name);
        assert.equal(after.currency, owner.organization.currency);
        await assert.rejects(
          async () =>
            await db.orm.public.Client.where({
              organizationId: owner.organization.id,
              id: client.id,
            }).deleteAll(),
        );
        assert.deepEqual(after, await detail(draft.id));
      },
    );
    await t.test(
      "stale versions and every non-draft state reject issuance",
      async () => {
        const draft = await create();
        await request(
          `/invoices/${draft.id}`,
          token,
          { ...input, expectedVersion: 1 },
          "PATCH",
        );
        await issue(draft.id, 1, token, 409);
        assert.equal((await detail(draft.id)).status, "DRAFT");
        for (const status of ["PENDING", "PAID", "OVERDUE", "CANCELLED"]) {
          await db.orm.public.Invoice.where({
            organizationId: owner.organization.id,
            id: draft.id,
          }).updateAll({ status });
          await issue(draft.id, 2, token, 409);
        }
      },
    );
    await t.test("concurrent issuance has exactly one winner", async () => {
      const draft = await create();
      const results = await Promise.all([
        issue(draft.id, 1, token, null),
        issue(draft.id, 1, token, null),
      ]);
      assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
      assert.equal((await detail(draft.id)).version, 2);
    });
    await t.test(
      "issuance racing draft edit or deletion cannot finalize mixed data",
      async () => {
        for (const method of ["PATCH", "DELETE"]) {
          const draft = await create();
          const results = await Promise.all([
            issue(draft.id, 1, token, null),
            request(
              `/invoices/${draft.id}`,
              token,
              method === "PATCH"
                ? { ...input, notes: "Edited", expectedVersion: 1 }
                : { expectedVersion: 1 },
              method,
              null,
            ),
          ]);
          assert.equal(results.filter((r) => r.status === 200).length, 1);
          assert.ok(results.every((r) => [200, 404, 409].includes(r.status)));
          if (results[0].status === 200)
            assert.equal((await detail(draft.id)).notes, "Keep me");
        }
      },
    );
    await t.test(
      "inconsistent amounts and failed issuance leave draft unchanged",
      async () => {
        const corrupt = await create();
        await db.orm.public.Invoice.where({
          organizationId: owner.organization.id,
          id: corrupt.id,
        }).updateAll({ total: "1.00" });
        await issue(corrupt.id, 1, token, 400);
        assert.equal((await detail(corrupt.id)).status, "DRAFT");
        const draft = await create();
        const before = await detail(draft.id);
        sql(
          `CREATE FUNCTION fail_issue() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.status = 'ISSUED' THEN RAISE EXCEPTION 'Issuance test failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER fail_issue BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION fail_issue();`,
        );
        try {
          await issue(draft.id, 1, token, 500);
          assert.deepEqual(await detail(draft.id), before);
        } finally {
          sql(
            "DROP TRIGGER fail_issue ON invoices; DROP FUNCTION fail_issue();",
          );
        }
      },
    );
  } finally {
    await app.close();
  }
});
