import assert from "node:assert/strict";
import test from "node:test";
import {
  accrualPeriods,
  cappedAccrual,
  carryForwardMinutes,
  expirableCarryForward,
} from "../dist/src/modules/workforce/leave-accrual.js";
import { calculateUnpaidLeaveDeduction } from "../dist/src/modules/payroll/payroll-calculations.js";

test("annual accrual prorates a midyear joiner deterministically", () => {
  const rows = accrualPeriods(
    {
      frequency: "ANNUAL",
      entitlementMinutes: 9600,
      effectiveFrom: "2026-01-01",
      prorateNewJoiners: true,
    },
    "2026-07-15",
    "2026-12-31",
  );
  assert.deepEqual(rows, [{ key: "2026", date: "2026-07-15", minutes: 4800 }]);
});

test("monthly accrual installments add back to the annual entitlement", () => {
  const rows = accrualPeriods(
    {
      frequency: "MONTHLY",
      entitlementMinutes: 10001,
      effectiveFrom: "2026-01-01",
      prorateNewJoiners: false,
    },
    "2025-01-01",
    "2026-12-31",
  );
  assert.equal(
    rows.reduce((sum, row) => sum + row.minutes, 0),
    10001,
  );
  assert.equal(new Set(rows.map((row) => row.key)).size, 12);
});

test("balance cap and carry-forward modes preserve exact minutes", () => {
  assert.equal(cappedAccrual(950, 100, 1000), 50);
  assert.equal(carryForwardMinutes(900, "NONE"), 0);
  assert.equal(carryForwardMinutes(900, "FULL"), 900);
  assert.equal(carryForwardMinutes(900, "CAPPED", 480), 480);
});

test("carry-forward expiration preserves approved future leave", () => {
  assert.equal(expirableCarryForward(600, 480, 240), 360);
  assert.equal(expirableCarryForward(200, 480, 240), 0);
  assert.equal(expirableCarryForward(900, 480, 240), 480);
});

test("unpaid leave deduction uses exact cents and cannot exceed net pay", () => {
  assert.equal(calculateUnpaidLeaveDeduction("3000.00", 480, 9600, "2500.00"), "150.00");
  assert.equal(calculateUnpaidLeaveDeduction("3000.00", 9600, 9600, "2500.00"), "2500.00");
});
