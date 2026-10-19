import { Temporal } from "temporal-polyfill";
import type { Numeric } from "@prisma/orm-postgres/target/codec-types";

export type PayrollComponentInput = {
  name: string;
  type: "EARNING" | "DEDUCTION";
  amount: string;
  sortOrder?: number;
};

export function moneyToCents(value: string): bigint {
  if (!/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/.test(value))
    throw new Error("Invalid monetary amount");
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, "0"));
}

export function centsToMoney(value: bigint): string {
  const sign = value < 0n ? "-" : "";
  const absolute = value < 0n ? -value : value;
  return `${sign}${absolute / 100n}.${(absolute % 100n).toString().padStart(2, "0")}`;
}

export function payrollAmount(value: string): Numeric<14, 2> {
  moneyToCents(value);
  return value as Numeric<14, 2>;
}

export function validatePayPeriod(
  start: string,
  end: string,
  frequency: "MONTHLY" | "BIWEEKLY" | "WEEKLY",
) {
  const from = Temporal.PlainDate.from(start);
  const to = Temporal.PlainDate.from(end);
  if (Temporal.PlainDate.compare(from, to) > 0) throw new Error("Period end must follow start");
  const inclusiveDays = from.until(to).days + 1;
  if (frequency === "WEEKLY" && inclusiveDays !== 7)
    throw new Error("Weekly payroll periods must contain 7 days");
  if (frequency === "BIWEEKLY" && inclusiveDays !== 14)
    throw new Error("Biweekly payroll periods must contain 14 days");
  if (
    frequency === "MONTHLY" &&
    (from.day !== 1 || to.toString() !== from.add({ months: 1 }).subtract({ days: 1 }).toString())
  )
    throw new Error("Monthly payroll must cover one complete calendar month");
}

export function calculateFixedPayroll(baseAmount: string, components: PayrollComponentInput[]) {
  const base = moneyToCents(baseAmount);
  let earnings = 0n;
  let deductions = 0n;
  for (const component of components) {
    const amount = moneyToCents(component.amount);
    if (component.type === "EARNING") earnings += amount;
    else deductions += amount;
  }
  const gross = base + earnings;
  const net = gross - deductions;
  if (net < 0n) throw new Error("Deductions cannot exceed gross pay");
  return {
    baseAmount: centsToMoney(base),
    grossPay: centsToMoney(gross),
    totalDeductions: centsToMoney(deductions),
    netPay: centsToMoney(net),
  };
}
