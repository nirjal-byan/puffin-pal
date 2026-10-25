import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { createApplication } from "../dist/src/app.factory.js";
import { DATABASE } from "../dist/src/infrastructure/database/database.module.js";

test("onboarding registration, persistence, authentication and tenant isolation", async () => {
  assert.match(new URL(process.env.DATABASE_URL).pathname, /^\/puffinpal_auth_test_/);
  const app = await createApplication(true);
  await app.listen(0, "127.0.0.1");
  const db = app.get(DATABASE);
  const base = `${await app.getUrl()}/api/v1`;
  const password = "Onboarding-password-123";
  async function request(path, token, body, method = "PATCH", status = 200) {
    const response = await fetch(base + path, {
      method, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = await response.json();
    assert.equal(response.status, status, JSON.stringify(data));
    return data;
  }
  try {
    const signup = (slug) => request("/auth/signup", null, {
      organizationName: slug, organizationSlug: slug, fullName: "Tour User", email: "tour@test.example", password,
    }, "POST", 201);
    const first = await signup("tour-first");
    const second = await signup("tour-second");
    assert.equal(first.user.onboardingStatus, "PENDING");
    const path = "/auth/me/onboarding";
    await request(path, null, { status: "SKIPPED", step: "welcome" }, "PATCH", 401);
    await request(path, first.accessToken, { status: "COMPLETED", step: "finish", userId: second.user.id }, "PATCH", 400);
    assert.equal((await request(path, first.accessToken, { status: "IN_PROGRESS", step: "invoices" })).onboardingStep, "invoices");
    const me = await request("/auth/me", first.accessToken, undefined, "GET");
    assert.equal(me.user.onboardingStatus, "IN_PROGRESS");
    assert.equal(me.user.onboardingStep, "invoices");
    assert.equal((await request("/auth/me", second.accessToken, undefined, "GET")).user.onboardingStatus, "PENDING");
    await request(path, first.accessToken, { status: "COMPLETED", step: "finish" });
    assert.equal((await request(path, first.accessToken, { status: "IN_PROGRESS", step: "welcome" })).onboardingStatus, "COMPLETED");
    await request(path, second.accessToken, { status: "SKIPPED", step: "welcome" });
    const login = await request("/auth/login", null, { organizationSlug: "tour-second", email: "tour@test.example", password }, "POST");
    assert.equal(login.user.onboardingStatus, "SKIPPED");
    // Default must preserve the experience of pre-existing users, including accounts
    // provisioned through older tooling that doesn't specify onboarding fields.
    const legacy = await db.orm.public.User.create({ organizationId: first.organization.id, email: "legacy@test.example", fullName: "Legacy", passwordHash: "unused-test-hash" });
    assert.equal(legacy.onboardingStatus, "LEGACY");
  } finally { await app.close(); }
});
