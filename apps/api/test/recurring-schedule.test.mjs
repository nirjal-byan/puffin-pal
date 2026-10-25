import test from "node:test";
import assert from "node:assert/strict";
import { nextOccurrence } from "../dist/src/modules/recurring-invoices/recurring-schedule.js";

test("monthly schedules preserve their anchor and cap at month end", () => {
  assert.equal(nextOccurrence("2027-01-31T00:00:00Z", "2027-01-31T00:00:00Z", "MONTHLY", 1).toString(), "2027-02-28T00:00:00Z");
  assert.equal(nextOccurrence("2028-01-31T00:00:00Z", "2028-01-31T00:00:00Z", "MONTHLY", 1).toString(), "2028-02-29T00:00:00Z");
});

test("quarterly and multi-week intervals are deterministic UTC dates", () => {
  assert.equal(nextOccurrence("2026-01-31T00:00:00Z", "2026-01-31T00:00:00Z", "QUARTERLY", 1).toString(), "2026-04-30T00:00:00Z");
  assert.equal(nextOccurrence("2026-10-18T00:00:00Z", "2026-10-18T00:00:00Z", "WEEKLY", 2).toString(), "2026-11-01T00:00:00Z");
});
