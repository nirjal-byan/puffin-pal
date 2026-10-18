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
    const updated = await json(`/expenses/${expense.id}`, token, { amount: "15.20", vendor: "New Cloud Co", expectedVersion: expense.version }, "PATCH");
    assert.equal(updated.amount, "15.20");
    await request("/expenses", token, { title: "Bad", amount: "0", category: "OTHER", date: "2026-10-14" }, "POST", 400);
    const receipt = new FormData(); receipt.set("receipt", new Blob([Buffer.from("%PDF-1.4")], { type: "application/pdf" }), "receipt.pdf");
    const withReceipt = await (await request(`/expenses/${expense.id}/receipt`, token, receipt, "PUT", 200, true)).json();
    assert.equal(withReceipt.receiptName, "receipt.pdf"); assert.equal("receiptKey" in withReceipt, false);
    const download = await request(`/expenses/${expense.id}/receipt`, token, undefined, "GET");
    assert.equal(download.headers.get("content-type"), "application/pdf"); assert.equal(Buffer.from(await download.arrayBuffer()).toString(), "%PDF-1.4");
    await request(`/expenses/${expense.id}/receipt`, other.accessToken, undefined, "GET", 404);
    await json("/members", token, { email: "admin@expense.test", fullName: "Expense Admin", password, role: "ADMIN" }, "POST", 201);
    const admin = await json("/auth/login", null, { organizationSlug: "expense-owner", email: "admin@expense.test", password });
    await json("/members", token, { email: "manager@expense.test", fullName: "Project Manager", password, role: "PROJECT_MANAGER" }, "POST", 201);
    const manager = await json("/auth/login", null, { organizationSlug: "expense-owner", email: "manager@expense.test", password });
    const pending = await json(`/expenses/${expense.id}/submit`, token, { expectedVersion: withReceipt.version }, "POST");
    assert.equal(pending.approvalStatus, "PENDING_APPROVAL");
    await request(`/expenses/${expense.id}/receipt`, token, receipt, "PUT", 409, true);
    await request(`/expenses/${expense.id}/approve`, token, { expectedVersion: pending.version }, "POST", 403);
    const approved = await json(`/expenses/${expense.id}/approve`, admin.accessToken, { expectedVersion: pending.version }, "POST");
    assert.equal(approved.approvalStatus, "APPROVED");
    await request(`/expenses/${expense.id}`, token, { amount: "99.00", expectedVersion: approved.version }, "PATCH", 409);
    await request(`/expenses/${expense.id}`, token, undefined, "DELETE", 409);

    const revision = await json("/expenses", token, { title: "Travel", amount: "20.00", category: "TRAVEL", date: "2026-10-14" }, "POST", 201);
    const revisionPending = await json(`/expenses/${revision.id}/submit`, token, { expectedVersion: revision.version }, "POST");
    await request(`/expenses/${revision.id}/reject`, admin.accessToken, { expectedVersion: revisionPending.version, reason: " " }, "POST", 400);
    const rejected = await json(`/expenses/${revision.id}/reject`, admin.accessToken, { expectedVersion: revisionPending.version, reason: "Add the project code" }, "POST");
    const reopened = await json(`/expenses/${revision.id}/reopen`, token, { expectedVersion: rejected.version }, "POST");
    const revised = await json(`/expenses/${revision.id}`, token, { notes: "Project A", expectedVersion: reopened.version }, "PATCH");
    const resubmitted = await json(`/expenses/${revision.id}/submit`, token, { expectedVersion: revised.version }, "POST");
    await request(`/expenses/${revision.id}/reject`, admin.accessToken, { expectedVersion: revisionPending.version, reason: "stale" }, "POST", 409);
    await json(`/expenses/${revision.id}/approve`, admin.accessToken, { expectedVersion: resubmitted.version }, "POST");
    const detail = await json(`/expenses/${revision.id}`, token, undefined, "GET");
    assert.deepEqual(detail.approvalHistory.map((event) => event.action), ["SUBMITTED", "REJECTED", "REOPENED", "RESUBMITTED", "APPROVED"]);

    const raced = await json("/expenses", manager.accessToken, { title: "Race", amount: "5.00", category: "OTHER", date: "2026-10-14" }, "POST", 201);
    const racedPending = await json(`/expenses/${raced.id}/submit`, manager.accessToken, { expectedVersion: raced.version }, "POST");
    const approveRequest = (accessToken) => fetch(`${base}/expenses/${raced.id}/approve`, { method: "POST", headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" }, body: JSON.stringify({ expectedVersion: racedPending.version }) });
    const reviewResponses = await Promise.all([approveRequest(token), approveRequest(admin.accessToken)]);
    assert.deepEqual(reviewResponses.map((response) => response.status).sort(), [200, 409]);
    const racedDetail = await json(`/expenses/${raced.id}`, token, undefined, "GET");
    assert.equal(racedDetail.approvalHistory.filter((event) => event.action === "APPROVED").length, 1);
    await request(`/expenses/${raced.id}/approve`, other.accessToken, { expectedVersion: racedPending.version }, "POST", 404);
    await json("/members", token, { email: "viewer@expense.test", fullName: "Viewer", password, role: "FINANCE_VIEWER" }, "POST", 201);
    const viewer = await json("/auth/login", null, { organizationSlug: "expense-owner", email: "viewer@expense.test", password });
    await request("/expenses", viewer.accessToken, undefined, "GET"); await request("/expenses", viewer.accessToken, { title: "Denied", amount: "1.00", category: "OTHER", date: "2026-10-14" }, "POST", 403);
    await request(`/expenses/${expense.id}`, viewer.accessToken, undefined, "DELETE", 403);
    const disposable = await json("/expenses", token, { title: "Disposable", amount: "1.00", category: "OTHER", date: "2026-10-14" }, "POST", 201);
    await request(`/expenses/${disposable.id}`, token, undefined, "DELETE", 200);
    await request(`/expenses/${disposable.id}`, token, undefined, "GET", 404);
  } finally { await app.close(); }
});
