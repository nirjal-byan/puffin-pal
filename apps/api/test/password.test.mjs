import assert from "node:assert/strict";
import { test } from "node:test";
import { scryptSync } from "node:crypto";
import { hashPassword, verifyPassword } from "../dist/src/modules/auth/password.js";

test("password hashes use unique salts and verify without accepting incorrect passwords", async () => {
  const first = await hashPassword("a-long-test-password");
  const second = await hashPassword("a-long-test-password");
  assert.notEqual(first, second);
  assert.equal(await verifyPassword("a-long-test-password", first), true);
  assert.equal(await verifyPassword("incorrect", first), false);
});
test("legacy seed hashes still work and malformed hashes are rejected", async () => {
  const salt = "1234567890abcdef1234567890abcdef";
  const hash = `scrypt:${salt}:${scryptSync("seed-password", salt, 64).toString("hex")}`;
  assert.equal(await verifyPassword("seed-password", hash), true);
  for (const malformed of [
    "",
    "bcrypt:example",
    "scrypt:a:b",
    "scrypt:999999999:8:1:a:b",
    `${hash}:extra`,
  ]) {
    assert.equal(await verifyPassword("seed-password", malformed), false);
  }
});
