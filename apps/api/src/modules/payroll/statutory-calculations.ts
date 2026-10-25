import { centsToMoney, moneyToCents } from "./payroll-calculations.js";

export type StatutoryBracket = { lowerBound: string; upperBound?: string | null; rate: string };
export type StatutoryRuleInput = {
  name: string;
  kind: "FLAT_WITHHOLDING" | "EMPLOYEE_CONTRIBUTION" | "EMPLOYER_CONTRIBUTION";
  calculationType: "RATE" | "FIXED_AMOUNT";
  calculationBase: "TAXABLE_EARNINGS" | "GROSS_EARNINGS";
  rate?: string | null;
  fixedAmount?: string | null;
  minimumBase?: string | null;
  maximumBase?: string | null;
  contributionCap?: string | null;
};

function rateToMillionths(value: string) {
  if (!/^(?:0|1)(?:\.\d{1,6})?$/.test(value)) throw new Error("Rates must be between 0 and 1");
  const [whole, fraction = ""] = value.split(".");
  const result = BigInt(whole!) * 1_000_000n + BigInt(fraction.padEnd(6, "0"));
  if (result > 1_000_000n) throw new Error("Rates must be between 0 and 1");
  return result;
}

function roundedRate(base: bigint, rate: string) {
  return (base * rateToMillionths(rate) + 500_000n) / 1_000_000n;
}

export function validateBrackets(brackets: StatutoryBracket[]) {
  if (!brackets.length) return;
  let expected = 0n;
  for (const [index, bracket] of brackets.entries()) {
    const lower = moneyToCents(bracket.lowerBound);
    if (lower !== expected) throw new Error("Tax brackets must be contiguous and start at zero");
    rateToMillionths(bracket.rate);
    if (bracket.upperBound == null) {
      if (index !== brackets.length - 1)
        throw new Error("Only the final bracket may be open-ended");
      return;
    }
    const upper = moneyToCents(bracket.upperBound);
    if (upper <= lower) throw new Error("Tax bracket upper bounds must exceed lower bounds");
    expected = upper;
  }
  throw new Error("The final tax bracket must be open-ended");
}

export function progressiveTax(annualTaxableIncome: string, brackets: StatutoryBracket[]) {
  validateBrackets(brackets);
  const income = moneyToCents(annualTaxableIncome);
  let tax = 0n;
  for (const bracket of brackets) {
    const lower = moneyToCents(bracket.lowerBound);
    if (income <= lower) break;
    const upper = bracket.upperBound == null ? income : moneyToCents(bracket.upperBound);
    const taxable = (income < upper ? income : upper) - lower;
    tax += roundedRate(taxable, bracket.rate);
  }
  return centsToMoney(tax);
}

function ruleAmount(rule: StatutoryRuleInput, taxable: bigint, gross: bigint) {
  let base = rule.calculationBase === "TAXABLE_EARNINGS" ? taxable : gross;
  if (rule.minimumBase && base < moneyToCents(rule.minimumBase)) return 0n;
  if (rule.maximumBase && base > moneyToCents(rule.maximumBase))
    base = moneyToCents(rule.maximumBase);
  let amount =
    rule.calculationType === "RATE"
      ? roundedRate(base, rule.rate ?? "")
      : moneyToCents(rule.fixedAmount ?? "");
  if (rule.contributionCap && amount > moneyToCents(rule.contributionCap))
    amount = moneyToCents(rule.contributionCap);
  return amount;
}

export function calculateStatutory(input: {
  grossEarnings: string;
  taxableEarnings: string;
  nonTaxableEarnings: string;
  preTaxDeductions: string;
  postTaxDeductions: string;
  brackets: StatutoryBracket[];
  rules: StatutoryRuleInput[];
  periodsPerYear?: number | null;
}) {
  const gross = moneyToCents(input.grossEarnings);
  const preTax = moneyToCents(input.preTaxDeductions);
  const postTax = moneyToCents(input.postTaxDeductions);
  const taxable = moneyToCents(input.taxableEarnings) - preTax;
  if (taxable < 0n) throw new Error("Pre-tax deductions cannot exceed taxable earnings");
  let tax = 0n;
  if (input.brackets.length) {
    if (!input.periodsPerYear || input.periodsPerYear < 1)
      throw new Error("Progressive tax requires an explicit periods-per-year method");
    const annualTax = moneyToCents(
      progressiveTax(centsToMoney(taxable * BigInt(input.periodsPerYear)), input.brackets),
    );
    tax = (annualTax + BigInt(Math.floor(input.periodsPerYear / 2))) / BigInt(input.periodsPerYear);
  }
  let employee = 0n;
  let employer = 0n;
  const items = input.rules.map((rule) => {
    const amount = ruleAmount(rule, taxable, gross);
    if (rule.kind === "EMPLOYER_CONTRIBUTION") employer += amount;
    else if (rule.kind === "EMPLOYEE_CONTRIBUTION") employee += amount;
    else tax += amount;
    return { name: rule.name, kind: rule.kind, amount: centsToMoney(amount) };
  });
  const deductions = preTax + postTax + tax + employee;
  if (deductions > gross) throw new Error("Employee deductions cannot exceed gross earnings");
  return {
    grossEarnings: centsToMoney(gross),
    taxableEarnings: centsToMoney(taxable),
    nonTaxableEarnings: centsToMoney(moneyToCents(input.nonTaxableEarnings)),
    preTaxDeductions: centsToMoney(preTax),
    taxWithholding: centsToMoney(tax),
    employeeContributions: centsToMoney(employee),
    postTaxDeductions: centsToMoney(postTax),
    employerContributions: centsToMoney(employer),
    netPay: centsToMoney(gross - deductions),
    totalEmployerCost: centsToMoney(gross + employer),
    items,
  };
}
