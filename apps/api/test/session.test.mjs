import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { JwtService } from "@nestjs/jwt";
import { AuthService } from "../dist/src/auth/auth.service.js";
import { AuthController } from "../dist/src/auth/auth.controller.js";
import { hashPassword } from "../dist/src/auth/password.js";

const secret = "test-session-secret-at-least-32-bytes-long";
process.env.JWT_SECRET = secret;
const jwt = new JwtService({
  secret,
  signOptions: {
    algorithm: "HS256",
    issuer: "puffinpal",
    audience: "puffinpal-api",
    expiresIn: 900,
  },
  verifyOptions: {
    algorithms: ["HS256"],
    issuer: "puffinpal",
    audience: "puffinpal-api",
  },
});
async function setup() {
  const user = {
    id: "user-1",
    email: "owner@example.test",
    fullName: "Owner",
    passwordHash: await hashPassword("old-password-123"),
    avatarUrl: null,
  };
  const membership = { role: "OWNER" };
  const query = (data) => ({
    where: () => ({
      select: (...keys) => ({
        first: async () =>
          data ? Object.fromEntries(keys.map((key) => [key, data[key]])) : null,
      }),
    }),
  });
  const db = {
    orm: {
      public: {
        User: query(user),
        Membership: query(membership),
        Organization: query({
          id: "org-1",
          name: "Test",
          slug: "test",
          currency: "USD",
        }),
      },
    },
  };
  const service = new AuthService(db, jwt);
  return {
    user,
    membership,
    service,
    token: await service.createRefreshToken("user-1", "org-1"),
  };
}
test("refresh returns a fresh short-lived access token and current permissions", async () => {
  const { service, membership, token } = await setup();
  const decoded = jwt.decode(token);
  assert.equal(decoded.exp - decoded.iat, 7 * 24 * 60 * 60);
  membership.role = "FINANCE_VIEWER";
  const session = await service.refresh(token);
  assert.equal(session.role, "FINANCE_VIEWER");
  assert.equal(session.expiresIn, 900);
  assert.equal((await jwt.verifyAsync(session.accessToken)).sub, "user-1");
  assert.doesNotMatch(JSON.stringify(session), /passwordHash|passwordVersion/);
  await assert.rejects(jwt.verifyAsync(token));
  await assert.rejects(service.refresh(session.accessToken));
});
test("refresh rejects expired, tampered, password-invalidated, and invalid membership sessions", async () => {
  const { service, user, membership, token } = await setup();
  const expired = await jwt.signAsync(
    { sub: "user-1", organizationId: "org-1", kind: "refresh" },
    { audience: "puffinpal-refresh", expiresIn: -1 },
  );
  await assert.rejects(service.refresh(expired));
  await assert.rejects(service.refresh(`${token}invalid`));
  user.passwordHash = await hashPassword("new-password-123");
  await assert.rejects(service.refresh(token), /Session no longer valid/);
  const nextToken = await service.createRefreshToken("user-1", "org-1");
  membership.role = "INVALID";
  await assert.rejects(
    service.refresh(nextToken),
    /Membership is no longer valid/,
  );
});
test("logout clears the protected cookie and rejects cross-origin requests", () => {
  const controller = new AuthController({});
  let cleared;
  const response = {
    clearCookie(name, options) {
      cleared = { name, options };
    },
  };
  controller.logout(
    { headers: { origin: process.env.WEB_ORIGIN ?? "http://localhost:3000" } },
    response,
  );
  assert.equal(cleared.name, "puffinpal_refresh");
  assert.equal(cleared.options.httpOnly, true);
  assert.equal(cleared.options.sameSite, "lax");
  assert.equal(cleared.options.path, "/api/v1/auth");
  assert.throws(
    () =>
      controller.logout(
        { headers: { origin: "https://attacker.example" } },
        response,
      ),
    /Request origin is not allowed/,
  );
});
