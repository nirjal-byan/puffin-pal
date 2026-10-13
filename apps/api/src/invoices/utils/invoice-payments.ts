import { BadRequestException } from "@nestjs/common";
import { Temporal } from "temporal-polyfill";
import { decimalFromCents } from "./invoice-calculations.js";

export function paymentCents(value: string): bigint {
  if (typeof value !== "string" || !/^(0|[1-9]\d{0,9})(\.\d{1,2})?$/.test(value))
    throw new BadRequestException("Provide a valid amount with at most two decimal places");
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, "0"));
}
export function receivedPaymentDate(value: string) {
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error();
    const date = Temporal.PlainDate.from(value);
    if (Temporal.PlainDate.compare(date, Temporal.Now.plainDateISO("UTC")) > 0) throw new Error();
    return Temporal.Instant.from(`${date}T00:00:00Z`);
  } catch {
    throw new BadRequestException("Payment date must be a valid date, no later than today (UTC)");
  }
}

export function invoicePaymentSummary(
  invoice: { status: string; total: string; dueDate: { toString(): string }; issuedAt?: unknown },
  payments: readonly { amount: string }[],
  today = Temporal.Now.plainDateISO("UTC").toString(),
) {
  const total = paymentCents(invoice.total);
  // Preserve historical PAID records without inventing ledger entries.
  const legacyPaid = invoice.status === "PAID" && payments.length === 0 && total > 0n;
  const paid = legacyPaid ? total : payments.reduce((sum, payment) => sum + paymentCents(payment.amount), 0n);
  const balance = total - paid;
  const finalized = ["ISSUED", "PAID", "OVERDUE"].includes(invoice.status);
  // Due dates are inclusive calendar dates in UTC, not midnight deadlines.
  const isOverdue = finalized && balance > 0n && invoice.dueDate.toString().slice(0, 10) < today;
  const displayStatus = finalized
    ? balance === 0n ? "PAID" : isOverdue ? "OVERDUE" : "ISSUED"
    : invoice.status;
  return {
    totalPaid: decimalFromCents(paid),
    outstandingBalance: decimalFromCents(balance),
    isOverdue,
    displayStatus,
    legacyPaid,
  };
}
