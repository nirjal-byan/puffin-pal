import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateStatutory,
  progressiveTax,
  validateBrackets,
} from "../dist/src/modules/payroll/statutory-calculations.js";

const brackets = [
  { lowerBound: "0.00", upperBound: "500000.00", rate: "0" },
  { lowerBound: "500000.00", upperBound: "800000.00", rate: "0.10" },
  { lowerBound: "800000.00", upperBound: "1200000.00", rate: "0.20" },
  { lowerBound: "1200000.00", rate: "0.30" },
];

test("progressive brackets apply marginal rates at exact boundaries", () => {
  assert.equal(progressiveTax("500000.00", brackets), "0.00");
  assert.equal(progressiveTax("800000.00", brackets), "30000.00");
  assert.equal(progressiveTax("1300000.00", brackets), "140000.00");
});

test("bracket validation rejects gaps and a missing open final bracket", () => {
  assert.throws(() => validateBrackets([{ lowerBound: "1.00", rate: "0.1" }]), /contiguous/);
  assert.throws(
    () => validateBrackets([{ lowerBound: "0.00", upperBound: "10.00", rate: "0.1" }]),
    /open-ended/,
  );
});

test("gross-to-net separates employee and employer contributions", () => {
  const result = calculateStatutory({
    grossEarnings: "1000.00",
    taxableEarnings: "900.00",
    nonTaxableEarnings: "100.00",
    preTaxDeductions: "50.00",
    postTaxDeductions: "20.00",
    brackets: [],
    rules: [
      {
        name: "Withholding",
        kind: "FLAT_WITHHOLDING",
        calculationType: "RATE",
        calculationBase: "TAXABLE_EARNINGS",
        rate: "0.10",
      },
      {
        name: "Employee retirement",
        kind: "EMPLOYEE_CONTRIBUTION",
        calculationType: "RATE",
        calculationBase: "GROSS_EARNINGS",
        rate: "0.05",
        contributionCap: "40.00",
      },
      {
        name: "Employer retirement",
        kind: "EMPLOYER_CONTRIBUTION",
        calculationType: "RATE",
        calculationBase: "GROSS_EARNINGS",
        rate: "0.07",
      },
    ],
  });
  assert.equal(result.taxWithholding, "85.00");
  assert.equal(result.employeeContributions, "40.00");
  assert.equal(result.employerContributions, "70.00");
  assert.equal(result.netPay, "805.00");
  assert.equal(result.totalEmployerCost, "1070.00");
});

test("progressive withholding requires explicit annualization", () => {
  assert.throws(
    () =>
      calculateStatutory({
        grossEarnings: "100.00",
        taxableEarnings: "100.00",
        nonTaxableEarnings: "0.00",
        preTaxDeductions: "0.00",
        postTaxDeductions: "0.00",
        brackets,
        rules: [],
      }),
    /periods-per-year/,
  );
});
