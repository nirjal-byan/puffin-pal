import type { Permission } from "@puffinpal/permissions";
import type { InvoiceDetail } from "../types/invoice.types";

export const PAYMENT_METHODS = [
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "CASH", label: "Cash" },
  { value: "CARD", label: "Card" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "OTHER", label: "Other" },
] as const;
function cents(value: string) {
  if (!/^(0|[1-9]\d{0,9})(\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, "0"));
}
export function canRecordPayment(
  invoice: Pick<InvoiceDetail, "status" | "issuedAt" | "outstandingBalance">,
  permissions: readonly Permission[],
) {
  return (
    !!invoice.issuedAt &&
    ["ISSUED", "OVERDUE"].includes(invoice.status) &&
    permissions.includes("invoices:record-payment") &&
    (cents(invoice.outstandingBalance) ?? 0n) > 0n
  );
}
export function validatePayment(
  input: { amount: string; paymentDate: string; method: string; reference: string; notes: string },
  balance: string,
  today = new Date().toISOString().slice(0, 10),
) {
  const amount = cents(input.amount);
  if (amount === null || amount <= 0n)
    return "Enter a positive amount with at most two decimal places.";
  const outstanding = cents(balance);
  if (outstanding === null || amount > outstanding)
    return "Payment cannot exceed the outstanding balance.";
  const date = new Date(`${input.paymentDate}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(input.paymentDate) ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== input.paymentDate ||
    input.paymentDate > today
  )
    return "Choose a valid payment date, no later than today (UTC).";
  if (!PAYMENT_METHODS.some((method) => method.value === input.method))
    return "Choose a payment method.";
  if (input.reference.length > 120) return "Reference must be at most 120 characters.";
  if (input.notes.length > 2000) return "Notes must be at most 2,000 characters.";
  return "";
}
