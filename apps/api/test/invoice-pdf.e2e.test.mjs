import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { createApplication } from "../dist/src/app.factory.js";
import { DATABASE } from "../dist/src/database.module.js";

test("invoice PDF downloads enforce authentication, eligibility and tenant boundaries", async (t) => {
  assert.match(new URL(process.env.DATABASE_URL).pathname, /^\/puffinpal_auth_test_/);
  const app = await createApplication(true);
  await app.listen(0, "127.0.0.1");
  const base = `${await app.getUrl()}/api/v1`;
  const db = app.get(DATABASE);
  const password = "Pdf-test-password-123";
  async function request(path, token, body, method = "POST", status = 200) {
    const response = await fetch(base + path, {
      method, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    assert.equal(response.status, status, `${method} ${path}`);
    return response;
  }
  const json = async (...args) => (await request(...args)).json();
  try {
    const signup = (slug) => json("/auth/signup", null, {
      organizationName: slug, organizationSlug: slug, fullName: "PDF Owner", email: "owner@pdf.test", password,
    }, "POST", 201);
    const owner = await signup("pdf-seller");
    const other = await signup("pdf-other");
    const token = owner.accessToken;
    const client = await json("/clients", token, {
      name: "Snapshot Buyer", email: "buyer@pdf.test", companyName: "Snapshot Company", taxId: "PDF-TAX",
    }, "POST", 201);
    const draft = await json("/invoices", token, {
      clientId: client.id, issueDate: "2026-10-10", dueDate: "2026-11-10", notes: "PDF test notes",
      items: [{ description: "Precise consulting", quantity: 3, unitPrice: "0.10" }],
    }, "POST", 201);
    const path = `/invoices/${draft.id}/pdf`;
    await t.test("unauthenticated, cross-tenant, missing and draft downloads are rejected", async () => {
      await request(path, null, undefined, "GET", 401);
      await request(path, other.accessToken, undefined, "GET", 404);
      await request(`/invoices/${randomUUID()}/pdf`, token, undefined, "GET", 404);
      await request("/invoices/invalid/pdf", token, undefined, "GET", 400);
      await request(path, token, undefined, "GET", 409);
    });
    await json(`/invoices/${draft.id}/issue`, token, { expectedVersion: 1 });
    await json(`/clients/${client.id}`, token, { name: "Changed Buyer", email: "changed@pdf.test", companyName: "Changed Company", taxId: "CHANGED-TAX" }, "PATCH");
    await t.test("issued download uses snapshots, decimal values and attachment headers", async () => {
      const response = await request(path, token, undefined, "GET");
      assert.equal(response.headers.get("content-type"), "application/pdf");
      assert.equal(response.headers.get("cache-control"), "private, no-store");
      assert.equal(response.headers.get("content-disposition"), `attachment; filename="${draft.invoiceNumber}.pdf"`);
      const buffer = Buffer.from(await response.arrayBuffer());
      assert.equal(buffer.subarray(0, 5).toString(), "%PDF-");
      assert.equal(Number(response.headers.get("content-length")), buffer.length);
      const extracted = spawnSync("pdftotext", ["-layout", "-", "-"], { input: buffer });
      if (extracted.error?.code !== "ENOENT") {
        assert.equal(extracted.status, 0, extracted.stderr?.toString());
        const text = extracted.stdout.toString();
        for (const value of ["Snapshot Buyer", "Snapshot Company", "PDF-TAX", "buyer@pdf.test", "pdf-seller", "Precise consulting", "USD 0.10", "USD 0.30", "USD 0.00", "PDF test notes"])
          assert.ok(text.includes(value), `Missing ${value}`);
        assert.ok(!text.includes("Changed Buyer"));
        assert.ok(!text.includes("Changed Company"));
      }
      await request(path, other.accessToken, undefined, "GET", 404);
    });
    await t.test("all roles with invoices:read can download; revoked membership cannot", async () => {
      for (const role of ["ADMIN", "PROJECT_MANAGER", "FINANCE_VIEWER"]) {
        const email = `${role.toLowerCase()}@pdf.test`;
        await json("/members", token, { email, fullName: role, password, role }, "POST", 201);
        const login = await json("/auth/login", null, { organizationSlug: "pdf-seller", email, password });
        await request(path, login.accessToken, undefined, "GET");
        await db.orm.public.Membership.where({ organizationId: owner.organization.id, userId: login.user.id }).delete();
        await request(path, login.accessToken, undefined, "GET", 401);
      }
    });
  } finally { await app.close(); }
});
