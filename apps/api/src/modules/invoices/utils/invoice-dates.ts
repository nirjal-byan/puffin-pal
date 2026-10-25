import { BadRequestException } from "@nestjs/common";
import { Temporal } from "temporal-polyfill";
export function invoiceDates(issueDate: string, dueDate: string) {
  try {
    const instant = (value: string) =>
      Temporal.Instant.from(value.length === 10 ? `${value}T00:00:00Z` : value);
    const issue = instant(issueDate);
    const due = instant(dueDate);
    if (Temporal.Instant.compare(due, issue) < 0) throw new Error("Due date precedes issue date");
    return { issueDate: issue, dueDate: due };
  } catch {
    throw new BadRequestException(
      "Provide valid ISO dates; due date must not be earlier than issue date",
    );
  }
}
