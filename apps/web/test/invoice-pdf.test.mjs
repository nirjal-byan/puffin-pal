import assert from "node:assert/strict";
import { test } from "node:test";
import { canDownloadInvoicePdf } from "../features/invoices/schemas/invoice.schema.ts";
import { downloadInvoicePdf } from "../features/invoices/api/invoices.ts";

let instance = 0;
const load = () => import(`../lib/api.ts?pdf=${instance++}`);
const session = (token) => ({ accessToken: token, user: { id: "user" }, organization: { id: "org" }, permissions: [] });
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

test("PDF action eligibility requires issued status and invoice read permission", () => {
  assert.equal(canDownloadInvoicePdf("ISSUED", ["invoices:read"]), true);
  assert.equal(canDownloadInvoicePdf("ISSUED", []), false);
  for (const status of [undefined, "DRAFT", "PENDING", "CANCELLED"])
    assert.equal(canDownloadInvoicePdf(status, ["invoices:read"]), false);
  for (const status of ["PAID", "OVERDUE"])
    assert.equal(canDownloadInvoicePdf(status, ["invoices:read"]), true);
});
test("PDF requests return binary data and pass an abort signal", async (t) => {
  const api = await load();
  const abort = new AbortController();
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.ok(url.endsWith("/invoices/invoice-1/pdf"));
    assert.equal(options.signal, abort.signal);
    assert.equal(options.headers.Authorization, "Bearer token");
    assert.equal(options.cache, "no-store");
    return new Response("%PDF-binary", { headers: { "content-type": "application/pdf" } });
  });
  const result = await downloadInvoicePdf((path, options) => api.apiRequest(path, { ...options, token: "token" }), "invoice-1", abort.signal);
  assert.ok(result instanceof Blob);
  assert.equal(await result.text(), "%PDF-binary");
});
test("expired PDF request refreshes the session and retries binary download", async (t) => {
  const api = await load();
  api.setActiveSession(session("old"));
  let refreshes = 0;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    if (url.endsWith("/auth/refresh")) { refreshes++; return json(session("new")); }
    return options.headers.Authorization === "Bearer new"
      ? new Response("%PDF-refreshed", { headers: { "content-type": "application/pdf" } })
      : json({ message: "Expired" }, 401);
  });
  const result = await api.apiRequest("/invoices/1/pdf", { token: "old", responseType: "blob" });
  assert.equal(await result.text(), "%PDF-refreshed");
  assert.equal(refreshes, 1);
});
test("PDF failures remain actionable JSON errors, including refresh expiry", async (t) => {
  const api = await load();
  for (const status of [401, 403, 404, 409, 500]) {
    t.mock.method(globalThis, "fetch", async () => json({ message: "PDF unavailable" }, status));
    await assert.rejects(api.apiRequest("/invoices/1/pdf", { token: "token", responseType: "blob" }),
      (error) => error.status === status && error.message === "PDF unavailable");
  }
});
test("PDF download rejects unexpected response types and preserves aborts", async (t) => {
  const api = await load();
  t.mock.method(globalThis, "fetch", async () => json({}));
  await assert.rejects(api.apiRequest("/invoices/1/pdf", { responseType: "blob" }), (error) => error.status === 502);
  t.mock.method(globalThis, "fetch", async () => { throw new DOMException("Aborted", "AbortError"); });
  await assert.rejects(api.apiRequest("/invoices/1/pdf", { responseType: "blob" }), (error) => error.name === "AbortError");
});
