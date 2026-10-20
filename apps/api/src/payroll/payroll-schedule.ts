import { Temporal } from "temporal-polyfill";

export type PayrollScheduleFrequency = "WEEKLY" | "BIWEEKLY" | "SEMIMONTHLY" | "MONTHLY";

const date = (value: string | { toString(): string }) =>
  Temporal.PlainDate.from(value.toString().slice(0, 10));

export function assertTimezone(timezone: string) {
  try {
    Temporal.Now.instant().toZonedDateTimeISO(timezone);
  } catch {
    throw new Error("Provide a valid IANA timezone");
  }
}

export function assertScheduleStart(start: string, frequency: PayrollScheduleFrequency) {
  const value = date(start);
  if (frequency === "SEMIMONTHLY" && value.day !== 1 && value.day !== 16)
    throw new Error("Semimonthly schedules must start on the 1st or 16th");
  return value;
}

export function payrollPeriod(
  periodStart: string | { toString(): string },
  frequency: PayrollScheduleFrequency,
  anchorDay?: number,
) {
  const start = date(periodStart);
  let nextStart: Temporal.PlainDate;
  if (frequency === "WEEKLY") nextStart = start.add({ weeks: 1 });
  else if (frequency === "BIWEEKLY") nextStart = start.add({ weeks: 2 });
  else if (frequency === "SEMIMONTHLY") {
    if (start.day === 1) nextStart = start.with({ day: 16 });
    else nextStart = start.with({ day: 1 }).add({ months: 1 });
  } else {
    const target = start.with({ day: 1 }).add({ months: 1 });
    nextStart = target.with({ day: Math.min(anchorDay ?? start.day, target.daysInMonth) });
  }
  return { start, end: nextStart.subtract({ days: 1 }), nextStart };
}

export function localScheduleInstant(day: Temporal.PlainDate, time: string, timezone: string) {
  assertTimezone(timezone);
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) throw new Error("Generation time must use HH:mm");
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) throw new Error("Generation time must use HH:mm");
  return Temporal.ZonedDateTime.from({
    timeZone: timezone,
    year: day.year,
    month: day.month,
    day: day.day,
    hour,
    minute,
  }).toInstant();
}

export function schedulePeriod(
  periodStart: string | { toString(): string },
  frequency: PayrollScheduleFrequency,
  generationTime: string,
  timezone: string,
  anchorDay?: number,
) {
  const period = payrollPeriod(periodStart, frequency, anchorDay);
  return {
    ...period,
    scheduledFor: localScheduleInstant(period.nextStart, generationTime, timezone),
  };
}

export const utcDate = (value: Temporal.PlainDate) =>
  Temporal.Instant.from(`${value.toString()}T00:00:00Z`);
