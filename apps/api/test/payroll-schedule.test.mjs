import assert from "node:assert/strict";
import { test } from "node:test";
import { Temporal } from "temporal-polyfill";
import {
  assertScheduleStart,
  assertTimezone,
  payrollPeriod,
  schedulePeriod,
} from "../dist/src/modules/payroll/payroll-schedule.js";

test("weekly and biweekly periods use exact calendar boundaries", () => {
  const weekly = payrollPeriod("2026-10-05", "WEEKLY");
  assert.equal(weekly.end.toString(), "2026-10-11");
  assert.equal(weekly.nextStart.toString(), "2026-10-12");
  const biweekly = payrollPeriod("2026-10-05", "BIWEEKLY");
  assert.equal(biweekly.end.toString(), "2026-10-18");
  assert.equal(biweekly.nextStart.toString(), "2026-10-19");
});

test("semimonthly periods use 1-15 and 16-month end", () => {
  assert.equal(payrollPeriod("2026-02-01", "SEMIMONTHLY").end.toString(), "2026-02-15");
  assert.equal(payrollPeriod("2026-02-16", "SEMIMONTHLY").end.toString(), "2026-02-28");
  assert.equal(payrollPeriod("2028-02-16", "SEMIMONTHLY").end.toString(), "2028-02-29");
});

test("monthly periods clamp safely across short months and leap years", () => {
  assert.equal(payrollPeriod("2028-01-31", "MONTHLY").nextStart.toString(), "2028-02-29");
  assert.equal(payrollPeriod("2027-01-31", "MONTHLY").nextStart.toString(), "2027-02-28");
  assert.equal(payrollPeriod("2028-02-29", "MONTHLY", 31).nextStart.toString(), "2028-03-31");
});

test("scheduled instants honor daylight-saving timezone transitions", () => {
  const march = schedulePeriod("2026-03-02", "WEEKLY", "09:00", "America/Toronto");
  const november = schedulePeriod("2026-10-26", "WEEKLY", "09:00", "America/Toronto");
  assert.equal(march.scheduledFor.toZonedDateTimeISO("America/Toronto").hour, 9);
  assert.equal(november.scheduledFor.toZonedDateTimeISO("America/Toronto").hour, 9);
  assert.notEqual(
    march.scheduledFor.toZonedDateTimeISO("America/Toronto").offset,
    november.scheduledFor.toZonedDateTimeISO("America/Toronto").offset,
  );
  assert.equal(
    march.scheduledFor.toZonedDateTimeISO("America/Toronto").toPlainDate().toString(),
    "2026-03-09",
  );
});

test("malformed schedule configuration is rejected", () => {
  assert.throws(() => assertTimezone("Not/A_Timezone"));
  assert.throws(() => assertScheduleStart("2026-10-03", "SEMIMONTHLY"));
  assert.throws(() => Temporal.PlainDate.from("2026-02-30"));
});
