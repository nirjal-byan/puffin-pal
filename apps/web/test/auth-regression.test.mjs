import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const loginPage = await readFile(
  new URL("../src/features/auth/components/login-page.tsx", import.meta.url),
  "utf8",
);
const loginFields = await readFile(
  new URL("../src/features/auth/components/login-fields.tsx", import.meta.url),
  "utf8",
);
const passwordInput = await readFile(
  new URL("../src/components/ui/password-input.tsx", import.meta.url),
  "utf8",
);

test("login fields retain browser validation and credential autocomplete contracts", () => {
  assert.match(loginFields, /name="organizationSlug"[\s\S]*?required/);
  assert.match(loginFields, /pattern="\[a-z0-9\]\+\(-\[a-z0-9\]\+\)\*"/);
  assert.match(loginFields, /name="email"[\s\S]*?type="email"[\s\S]*?required/);
  assert.match(loginFields, /autoComplete="username"/);
  assert.match(loginFields, /name="password"[\s\S]*?autoComplete="current-password"/);
});

test("authentication submits normalized credentials and hands off only successful sessions", () => {
  assert.match(loginPage, /signup \? "\/auth\/signup" : "\/auth\/login"/);
  assert.match(loginPage, /organizationSlug:[\s\S]*?trim\(\)\.toLowerCase\(\)/);
  assert.match(loginPage, /email:[\s\S]*?trim\(\)\.toLowerCase\(\)/);
  assert.match(loginPage, /onAuthenticated\(session\)/);
  assert.match(loginPage, /catch \(failure\)[\s\S]*?setError\(errorMessage\(failure\)\)/);
  assert.match(loginPage, /finally \{[\s\S]*?setBusy\(false\)/);
});

test("registration protects staged validation and password confirmation", () => {
  assert.match(loginPage, /validateStep\(event\.currentTarget\)/);
  assert.match(loginPage, /Choose the number of employees before continuing/);
  assert.match(loginPage, /Choose your workspace currency before continuing/);
  assert.match(loginPage, /Passwords do not match/);
  assert.match(loginPage, /signupStep < 2/);
});

test("password visibility remains an accessible explicit toggle", () => {
  assert.match(passwordInput, /type=\{visible \? "text" : "password"\}/);
  assert.match(passwordInput, /aria-label=\{\x60\$\{visible \? "Hide" : "Show"\}/);
  assert.match(passwordInput, /aria-pressed=\{visible\}/);
  assert.match(passwordInput, /type="button"/);
});
