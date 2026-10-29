import assert from "node:assert/strict";
import { test } from "node:test";
import { readPhoneInput, PHONE_COUNTRIES } from "../src/lib/phone.ts";

test("international input detects the country and normalizes the number", () => {
  for (const [input, country, normalized] of [
    ["+44 20 7946 0018", "GB", "+442079460018"],
    ["+91 98765 43210", "IN", "+919876543210"],
    ["+977 9841234567", "NP", "+9779841234567"],
    ["0044 20 7946 0018", "GB", "+442079460018"],
    ["+1 416 555 0123", "CA", "+14165550123"],
  ]) {
    const result = readPhoneInput(input, "US");
    assert.equal(result.country, country);
    assert.equal(result.valid, true);
    assert.equal(result.normalized, normalized);
  }
});
test("national numbers respect the chosen country and dialing prefixes", () => {
  assert.equal(readPhoneInput("020 7946 0018", "GB").normalized, "+442079460018");
  assert.equal(readPhoneInput("(202) 555-0123", "US").normalized, "+12025550123");
});
test("partial country codes update the selector without accepting incomplete numbers", () => {
  const result = readPhoneInput("+977", "US");
  assert.equal(result.country, "NP");
  assert.equal(result.valid, false);
  assert.equal(result.normalized, "");
});
test("invalid input is not submitted and each country has a flag", () => {
  for (const input of ["", "abc", "+999123456789", "12"]) {
    assert.equal(readPhoneInput(input, "US").normalized, "");
  }
  assert.equal(PHONE_COUNTRIES.find((item) => item.country === "US").flag, "🇺🇸");
  assert.ok(PHONE_COUNTRIES.length > 200);
});
