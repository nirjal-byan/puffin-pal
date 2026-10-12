import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { createApplication } from "../dist/src/app.factory.js";

const logo =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
test("organization logos: signup, persistence, live permissions and isolation", async () => {
  assert.match(
    new URL(process.env.DATABASE_URL).pathname,
    /^\/puffinpal_auth_test_/,
  );
  const app = await createApplication(true);
  await app.listen(0, "127.0.0.1");
  const base = `${await app.getUrl()}/api/v1`;
  const password = "Logo-test-password-123";
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
    assert.equal(response.status, status, JSON.stringify(result));
    return result;
  }
  try {
    const signup = (slug, logoUrl) =>
      request(
        "/auth/signup",
        null,
        {
          organizationName: slug,
          organizationSlug: slug,
          fullName: "Owner",
          email: "owner@logo.test",
          password,
          ...(logoUrl ? { logoUrl } : {}),
        },
        "POST",
        201,
      );
    const a = await signup("logo-a", logo);
    const b = await signup("logo-b");
    assert.equal(a.organization.logoUrl, logo);
    assert.equal(b.organization.logoUrl, null);
    const update = (token, logoUrl, status = 200) =>
      request("/auth/organization/logo", token, { logoUrl }, "PATCH", status);
    const me = (token) => request("/auth/me", token, undefined, "GET");
    await update(null, logo, 401);
    await request("/auth/organization/logo", a.accessToken, {}, "PATCH", 400);
    await request(
      "/auth/organization/logo",
      a.accessToken,
      { logoUrl: logo, organizationId: b.organization.id },
      "PATCH",
      400,
    );
    await update(a.accessToken, "https://example.com/logo.png", 400);
    await update(a.accessToken, null);
    assert.equal((await me(a.accessToken)).organization.logoUrl, null);
    assert.equal(
      (await update(a.accessToken, logo)).organization.logoUrl,
      logo,
    );
    assert.equal((await me(a.accessToken)).organization.logoUrl, logo);
    assert.equal((await me(b.accessToken)).organization.logoUrl, null);
    for (const role of ["ADMIN", "PROJECT_MANAGER", "FINANCE_VIEWER"]) {
      const email = `${role.toLowerCase()}@logo.test`;
      await request(
        "/members",
        a.accessToken,
        { email, fullName: role, password, role },
        "POST",
        201,
      );
      const member = await request("/auth/login", null, {
        organizationSlug: "logo-a",
        email,
        password,
      });
      await update(member.accessToken, null, role === "ADMIN" ? 200 : 403);
    }
    assert.equal((await me(a.accessToken)).organization.logoUrl, null);
    assert.equal((await me(b.accessToken)).organization.logoUrl, null);
  } finally {
    await app.close();
  }
});
