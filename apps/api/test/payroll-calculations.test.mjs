import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateFixedPayroll,
  centsToMoney,
  moneyToCents,
  validatePayPeriod,
} from "../dist/src/modules/payroll/payroll-calculations.js";

test("fixed salary payroll uses exact decimal calculations", () => {
  assert.deepEqual(
    calculateFixedPayroll("5000.00", [
      { name: "Allowance", type: "EARNING", amount: "250.25" },
      { name: "Pension", type: "DEDUCTION", amount: "125.10" },
    ]),
    { baseAmount: "5000.00", grossPay: "5250.25", totalDeductions: "125.10", netPay: "5125.15" },
  );
});

test("money helpers preserve cents without floating point", () => {
  assert.equal(moneyToCents("900719925.47"), 90071992547n);
  assert.equal(centsToMoney(90071992547n), "900719925.47");
});

test("deductions cannot exceed gross pay", () => {
  assert.throws(
    () =>
      calculateFixedPayroll("100.00", [{ name: "Deduction", type: "DEDUCTION", amount: "100.01" }]),
    /cannot exceed/,
  );
});

test("pay periods match salary frequency", () => {
  assert.doesNotThrow(() => validatePayPeriod("2026-10-01", "2026-10-31", "MONTHLY"));
  assert.doesNotThrow(() => validatePayPeriod("2026-10-05", "2026-10-11", "WEEKLY"));
  assert.throws(
    () => validatePayPeriod("2026-10-01", "2026-10-30", "MONTHLY"),
    /complete calendar month/,
  );
});
