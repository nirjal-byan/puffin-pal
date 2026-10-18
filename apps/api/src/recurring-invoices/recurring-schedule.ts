import { Temporal } from "temporal-polyfill";

export type Frequency = "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY";
const plain = (value: string | { toString(): string }) => Temporal.PlainDate.from(value.toString().slice(0, 10));
export const utcInstant = (date: Temporal.PlainDate) => Temporal.Instant.from(`${date.toString()}T00:00:00Z`);

export function nextOccurrence(current: string | { toString(): string }, start: string | { toString(): string }, frequency: Frequency, interval: number) {
  const date = plain(current);
  const anchor = plain(start).day;
  if (frequency === "WEEKLY") return utcInstant(date.add({ weeks: interval }));
  const months = frequency === "MONTHLY" ? interval : frequency === "QUARTERLY" ? interval * 3 : interval * 12;
  const targetMonth = date.with({ day: 1 }).add({ months });
  return utcInstant(targetMonth.with({ day: Math.min(anchor, targetMonth.daysInMonth) }));
}

export function initialOccurrence(value: string) {
  return utcInstant(plain(value));
}
