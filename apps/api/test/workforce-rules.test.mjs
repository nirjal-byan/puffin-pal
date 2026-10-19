import assert from "node:assert/strict";
import test from "node:test";
import {
  attendanceMetrics,
  minutesBetween,
  overtimePay,
  workingLeaveUnits,
} from "../dist/src/workforce/workforce-rules.js";

test("leave units exclude weekends and configured holidays", () => {
  assert.equal(
    workingLeaveUnits("2026-10-16", "2026-10-20", [1, 2, 3, 4, 5], new Set(["2026-10-19"]), false),
    4,
  );
});

test("half-day leave is represented as one integer unit", () => {
  assert.equal(workingLeaveUnits("2026-10-20", "2026-10-20", [1, 2, 3, 4, 5], new Set(), true), 1);
  assert.throws(
    () => workingLeaveUnits("2026-10-20", "2026-10-21", [1, 2, 3, 4, 5], new Set(), true),
    /one date/,
  );
});

test("worked minutes use exact instants and support overnight work", () => {
  assert.equal(
    minutesBetween(
      { epochMilliseconds: Date.parse("2026-10-19T22:00:00Z") },
      { epochMilliseconds: Date.parse("2026-10-20T06:30:00Z") },
    ),
    510,
  );
});

test("attendance metrics keep missing records separate from absences", () => {
  const result = attendanceMetrics(
    [
      { status: "PRESENT", workedMinutes: 480, isLate: false },
      { status: "HALF_DAY", workedMinutes: 240, isLate: true },
    ],
    5,
  );
  assert.equal(result.absentDays, 0);
  assert.equal(result.missingRecords, 3);
  assert.equal(result.workedMinutes, 720);
});

test("overtime pay uses integer rounding from four-decimal snapshots", () => {
  assert.equal(overtimePay("20.0000", "1.5000", 90), "45.00");
  assert.equal(overtimePay("10.3333", null, 30), "5.17");
});
