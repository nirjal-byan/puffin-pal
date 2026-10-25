import { Temporal } from "temporal-polyfill";

export type AccrualPolicyInput = {
  frequency: "ANNUAL" | "MONTHLY" | "SERVICE_MONTHLY";
  entitlementMinutes: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  prorateNewJoiners: boolean;
};

export function accrualPeriods(policy: AccrualPolicyInput, hireDate: string, asOfDate: string) {
  const effective = Temporal.PlainDate.from(policy.effectiveFrom);
  const hire = Temporal.PlainDate.from(hireDate);
  const asOf = Temporal.PlainDate.from(asOfDate);
  const end = policy.effectiveTo ? Temporal.PlainDate.from(policy.effectiveTo) : asOf;
  const until = Temporal.PlainDate.compare(end, asOf) < 0 ? end : asOf;
  const start = Temporal.PlainDate.compare(effective, hire) > 0 ? effective : hire;
  if (Temporal.PlainDate.compare(start, until) > 0) return [];

  if (policy.frequency === "ANNUAL") {
    const periods: Array<{ key: string; date: string; minutes: number }> = [];
    for (let year = start.year; year <= until.year; year++) {
      const yearStart = Temporal.PlainDate.from({ year, month: 1, day: 1 });
      const date = Temporal.PlainDate.compare(start, yearStart) > 0 ? start : yearStart;
      if (Temporal.PlainDate.compare(date, until) > 0) continue;
      const remainingMonths = 13 - date.month;
      const minutes =
        policy.prorateNewJoiners && date.year === hire.year && date.month > 1
          ? Math.floor((policy.entitlementMinutes * remainingMonths) / 12)
          : policy.entitlementMinutes;
      periods.push({ key: `${year}`, date: date.toString(), minutes });
    }
    return periods;
  }

  const periods: Array<{ key: string; date: string; minutes: number }> = [];
  let cursor = Temporal.PlainDate.from({ year: start.year, month: start.month, day: 1 });
  while (Temporal.PlainDate.compare(cursor, until) <= 0) {
    const completed = cursor.add({ months: 1 }).subtract({ days: 1 });
    const eligible =
      policy.frequency === "MONTHLY" || Temporal.PlainDate.compare(completed, start) >= 0;
    if (eligible && Temporal.PlainDate.compare(completed, until) <= 0) {
      const base = Math.floor(policy.entitlementMinutes / 12);
      const remainder = policy.entitlementMinutes % 12;
      periods.push({
        key: `${cursor.year}-${String(cursor.month).padStart(2, "0")}`,
        date: completed.toString(),
        minutes: base + (cursor.month <= remainder ? 1 : 0),
      });
    }
    cursor = cursor.add({ months: 1 });
  }
  return periods;
}

export function cappedAccrual(
  currentBalanceMinutes: number,
  accrualMinutes: number,
  maximumBalanceMinutes?: number | null,
) {
  if (!maximumBalanceMinutes) return accrualMinutes;
  return Math.max(0, Math.min(accrualMinutes, maximumBalanceMinutes - currentBalanceMinutes));
}

export function carryForwardMinutes(
  balanceMinutes: number,
  mode: "NONE" | "FULL" | "CAPPED",
  cap?: number | null,
) {
  if (mode === "NONE") return 0;
  if (mode === "CAPPED") return Math.min(Math.max(0, balanceMinutes), cap ?? 0);
  return Math.max(0, balanceMinutes);
}

export function expirableCarryForward(
  availableMinutes: number,
  carriedMinutes: number,
  approvedFutureMinutes: number,
) {
  return Math.min(
    Math.max(0, carriedMinutes),
    Math.max(0, availableMinutes - Math.max(0, approvedFutureMinutes)),
  );
}
