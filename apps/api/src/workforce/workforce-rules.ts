import { Temporal } from "temporal-polyfill";

export const DEFAULT_WORKDAYS = [1, 2, 3, 4, 5] as const;

export function parseDate(value: string) {
  return Temporal.PlainDate.from(value);
}

export function dateInstant(value: string) {
  return Temporal.Instant.from(`${parseDate(value)}T00:00:00Z`);
}

export function minutesBetween(
  start: { epochMilliseconds: number },
  end: { epochMilliseconds: number },
) {
  const minutes = Math.floor((end.epochMilliseconds - start.epochMilliseconds) / 60_000);
  if (minutes < 0) throw new Error("Check-out cannot be before check-in");
  return minutes;
}

export function workingLeaveUnits(
  start: string,
  end: string,
  workdays: readonly number[],
  holidays: ReadonlySet<string>,
  halfDay: boolean,
) {
  let cursor = parseDate(start);
  const last = parseDate(end);
  if (Temporal.PlainDate.compare(cursor, last) > 0)
    throw new Error("End date must be on or after start date");
  if (halfDay && !cursor.equals(last)) throw new Error("Half-day leave must use one date");
  let units = 0;
  while (Temporal.PlainDate.compare(cursor, last) <= 0) {
    if (workdays.includes(cursor.dayOfWeek) && !holidays.has(cursor.toString()))
      units += halfDay ? 1 : 2;
    cursor = cursor.add({ days: 1 });
  }
  return units;
}

export function attendanceMetrics(
  records: readonly { status: string; workedMinutes?: number | null; isLate: boolean }[],
  scheduledDays: number,
) {
  const presentDays = records.filter((row) => row.status === "PRESENT").length;
  const absentDays = records.filter((row) => row.status === "ABSENT").length;
  const halfDays = records.filter((row) => row.status === "HALF_DAY").length;
  const approvedLeaveDays = records.filter((row) => row.status === "ON_LEAVE").length;
  const recordedUnits = presentDays * 2 + halfDays + approvedLeaveDays * 2;
  return {
    scheduledDays,
    presentDays,
    absentDays,
    halfDays,
    approvedLeaveDays,
    lateArrivals: records.filter((row) => row.isLate).length,
    workedMinutes: records.reduce((total, row) => total + (row.workedMinutes ?? 0), 0),
    attendancePercentage: scheduledDays
      ? Math.round((recordedUnits / (scheduledDays * 2)) * 100)
      : 0,
    missingRecords: Math.max(0, scheduledDays - records.length),
  };
}

function decimalUnits(value: string, scale: number) {
  if (!/^\d+(?:\.\d{1,4})?$/.test(value)) throw new Error("Invalid overtime rate");
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole!) * 10n ** BigInt(scale) + BigInt(fraction.padEnd(scale, "0"));
}

export function overtimePay(rate: string, multiplier: string | null | undefined, minutes: number) {
  if (!Number.isInteger(minutes) || minutes < 1)
    throw new Error("Overtime minutes must be positive");
  const rateUnits = decimalUnits(rate, 4);
  const multiplierUnits = decimalUnits(multiplier ?? "1", 4);
  const numerator = rateUnits * multiplierUnits * BigInt(minutes);
  const denominator = 60_000_000n;
  const cents = (numerator + denominator / 2n) / denominator;
  return `${cents / 100n}.${(cents % 100n).toString().padStart(2, "0")}`;
}
