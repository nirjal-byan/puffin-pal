import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { createApplication } from "../dist/src/app.factory.js";

test("expense CRUD, RBAC, tenant isolation and private receipts", async () => {
  assert.match(new URL(process.env.DATABASE_URL).pathname, /^\/puffinpal_auth_test_/);
  const app = await createApplication(true); await app.listen(0, "127.0.0.1");
  const base = `${await app.getUrl()}/api/v1`, password = "Expense-test-password-123";
  async function request(path, token, body, method = "POST", status = 200, multipart = false) {
    const response = await fetch(base + path, { method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(!multipart && body !== undefined ? { "content-type": "application/json" } : {}) }, ...(body === undefined ? {} : { body: multipart ? body : JSON.stringify(body) }) });
    assert.equal(response.status, status, `${method} ${path}: ${await response.clone().text()}`); return response;
  }
  const json = async (...args) => (await request(...args)).json();
  try {
    const signup = (slug) => json("/auth/signup", null, { organizationName: slug, organizationSlug: slug, fullName: "Owner", email: "owner@expense.test", password }, "POST", 201);
    const owner = await signup("expense-owner"), other = await signup("expense-other"), token = owner.accessToken;
    const expense = await json("/expenses", token, { title: "Cloud hosting", description: "October bill", amount: "12.34", category: "SOFTWARE", date: "2026-10-14", vendor: "Cloud Co", notes: "Monthly" }, "POST", 201);
    assert.equal(expense.amount, "12.34"); assert.equal("receiptKey" in expense, false);
    await request(`/expenses/${expense.id}`, other.accessToken, undefined, "GET", 404);
    const page = await json("/expenses?search=cloud&category=SOFTWARE&from=2026-10-01&to=2026-10-31&sort=amount&order=desc", token, undefined, "GET");
    assert.equal(page.total, 1); assert.equal(page.items[0].id, expense.id);
    const updated = await json(`/expenses/${expense.id}`, token, { amount: "15.20", vendor: "New Cloud Co" }, "PATCH");
    assert.equal(updated.amount, "15.20");
    await request("/expenses", token, { title: "Bad", amount: "0", category: "OTHER", date: "2026-10-14" }, "POST", 400);
    const receipt = new FormData(); receipt.set("receipt", new Blob([Buffer.from("%PDF-1.4")], { type: "application/pdf" }), "receipt.pdf");
    const withReceipt = await (await request(`/expenses/${expense.id}/receipt`, token, receipt, "PUT", 200, true)).json();
    assert.equal(withReceipt.receiptName, "receipt.pdf"); assert.equal("receiptKey" in withReceipt, false);
    const download = await request(`/expenses/${expense.id}/receipt`, token, undefined, "GET");
    assert.equal(download.headers.get("content-type"), "application/pdf"); assert.equal(Buffer.from(await download.arrayBuffer()).toString(), "%PDF-1.4");
    await request(`/expenses/${expense.id}/receipt`, other.accessToken, undefined, "GET", 404);
    await json("/members", token, { email: "viewer@expense.test", fullName: "Viewer", password, role: "FINANCE_VIEWER" }, "POST", 201);
    const viewer = await json("/auth/login", null, { organizationSlug: "expense-owner", email: "viewer@expense.test", password });
    await request("/expenses", viewer.accessToken, undefined, "GET"); await request("/expenses", viewer.accessToken, { title: "Denied", amount: "1.00", category: "OTHER", date: "2026-10-14" }, "POST", 403);
    await request(`/expenses/${expense.id}`, viewer.accessToken, undefined, "DELETE", 403);
    await request(`/expenses/${expense.id}`, token, undefined, "DELETE", 200);
    await request(`/expenses/${expense.id}`, token, undefined, "GET", 404);
  } finally { await app.close(); }
});
