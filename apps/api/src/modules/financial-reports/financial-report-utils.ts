import { BadRequestException } from "@nestjs/common";
import { Temporal } from "temporal-polyfill";

export function validateReportRange(from: string, to: string) {
  try {
    const start = Temporal.PlainDate.from(from);
    const end = Temporal.PlainDate.from(to);
    const days = start.until(end, { largestUnit: "day" }).days;
    if (days < 0) throw new BadRequestException("from must be on or before to");
    if (days > 1_826) throw new BadRequestException("Reporting ranges cannot exceed five years");
  } catch (error) {
    if (error instanceof BadRequestException) throw error;
    throw new BadRequestException("Provide valid from and to dates");
  }
}

export function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
