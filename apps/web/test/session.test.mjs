import assert from "node:assert/strict";
import { test } from "node:test";
let instance = 0;
const load = () => import(`../src/lib/api.ts?test=${instance++}`);
const session = (token) => ({
  accessToken: token,
  user: { id: "user-1" },
  organization: { id: "org-1" },
  permissions: [],
  expiresIn: 900,
});
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

test("concurrent expired requests share one refresh and retry with the new token", async (t) => {
  const api = await load();
  api.setActiveSession(session("old-token"));
  let refreshes = 0;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(options.credentials, "include");
    if (url.endsWith("/auth/refresh")) {
      refreshes++;
      return json(session("new-token"));
    }
    return options.headers.Authorization === "Bearer new-token"
      ? json(["record"])
      : json({ message: "Expired" }, 401);
  });
  const result = await Promise.all([
    api.apiRequest("/clients", { token: "old-token" }),
    api.apiRequest("/invoices", { token: "old-token" }),
  ]);
  assert.deepEqual(result, [["record"], ["record"]]);
  assert.equal(refreshes, 1);
  assert.equal(api.getActiveSession().accessToken, "new-token");
});
test("temporary refresh network failures preserve the session", async (t) => {
  const api = await load();
  api.setActiveSession(session("old-token"));
  t.mock.method(globalThis, "fetch", async (url) => {
    if (url.endsWith("/auth/refresh")) throw new Error("Offline");
    return json({}, 401);
  });
  await assert.rejects(
    api.apiRequest("/clients", { token: "old-token" }),
    (error) => error.status === 0,
  );
  assert.equal(api.getActiveSession().accessToken, "old-token");
});
test("an in-flight refresh cannot restore a session after logout", async (t) => {
  const api = await load();
  api.setActiveSession(session("old-token"));
  let finish;
  t.mock.method(
    globalThis,
    "fetch",
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const pending = api.refreshSession();
  api.setActiveSession(null);
  finish(json(session("new-token")));
  await assert.rejects(pending, (error) => error.status === 409);
  assert.equal(api.getActiveSession(), null);
});
