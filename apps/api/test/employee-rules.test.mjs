import test from "node:test";
import assert from "node:assert/strict";
import { assertManagerChain, rangesOverlap } from "../dist/src/modules/employees/employee-rules.js";

test("salary effective date ranges reject open and closed overlaps", () => {
  assert.equal(rangesOverlap("2026-01-01", null, "2027-01-01", null), true);
  assert.equal(rangesOverlap("2026-01-01", "2026-12-31", "2027-01-01", null), false);
  assert.equal(rangesOverlap("2026-01-01", "2026-12-31", "2026-12-31", "2027-01-31"), true);
});

test("manager hierarchy rejects self-management and indirect cycles", () => {
  assert.throws(() => assertManagerChain("a", "a", new Map()), /cannot manage/);
  assert.throws(() => assertManagerChain("a", "b", new Map([["b", "c"], ["c", "a"]])), /cannot manage/);
  assert.doesNotThrow(() => assertManagerChain("a", "b", new Map([["b", "c"], ["c", null]])));
});
