import type { Permission } from "@puffinpal/permissions";
import type {
  CreateInvoicePayload,
  InvoiceDraft,
  InvoiceLine,
} from "../types/invoice.types";
export const MAX_ITEMS = 100;
const MAX_CENTS = 999999999999n;
const PRICE = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/;
export const canCreateInvoice = (permissions: readonly Permission[]) =>
  permissions.includes("invoices:create");
export function newLine(id: string): InvoiceLine {
  return { id, description: "", quantity: "1", unitPrice: "0.00" };
}
export function addLine(items: InvoiceLine[], id: string) {
  return items.length < MAX_ITEMS ? [...items, newLine(id)] : items;
}
export function removeLine(items: InvoiceLine[], id: string) {
  return items.length > 1 ? items.filter((item) => item.id !== id) : items;
}
export function formatCents(cents: bigint) {
  return `${cents / 100n}.${(cents % 100n).toString().padStart(2, "0")}`;
}
export function lineAmount(line: InvoiceLine): bigint | null {
  if (
    !/^[1-9]\d*$/.test(line.quantity) ||
    line.quantity.length > 10 ||
    BigInt(line.quantity) > 2147483647n ||
    !PRICE.test(line.unitPrice)
  )
    return null;
  const [whole, fraction = ""] = line.unitPrice.split(".");
  const amount =
    BigInt(line.quantity) *
    (BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, "0")));
  return amount <= MAX_CENTS ? amount : null;
}
export function invoicePreview(items: InvoiceLine[]) {
  let cents = 0n;
  for (const item of items) {
    const amount = lineAmount(item);
    if (amount === null) return null;
    cents += amount;
    if (cents > MAX_CENTS) return null;
  }
  return items.length ? formatCents(cents) : null;
}
function calendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
export function validateInvoice(draft: InvoiceDraft): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!draft.clientId) errors.clientId = "Choose a client.";
  if (!calendarDate(draft.issueDate))
    errors.issueDate = "Choose a valid issue date.";
  if (!calendarDate(draft.dueDate)) errors.dueDate = "Choose a valid due date.";
  if (!errors.issueDate && !errors.dueDate && draft.dueDate < draft.issueDate)
    errors.dueDate = "Due date cannot be earlier than issue date.";
  if (draft.notes.length > 5000) errors.notes = "Use at most 5000 characters.";
  if (!draft.items.length || draft.items.length > MAX_ITEMS)
    errors.items = "Provide between 1 and 100 line items.";
  for (const line of draft.items) {
    if (!line.description.trim() || line.description.length > 1000)
      errors[`${line.id}.description`] =
        "Enter a description (at most 1000 characters).";
    if (
      !/^[1-9]\d*$/.test(line.quantity) ||
      line.quantity.length > 10 ||
      BigInt(line.quantity || "0") > 2147483647n
    )
      errors[`${line.id}.quantity`] =
        "Use a positive whole number, up to 2,147,483,647.";
    if (!PRICE.test(line.unitPrice))
      errors[`${line.id}.unitPrice`] =
        "Use a nonnegative price with at most 2 decimal places.";
    if (
      !errors[`${line.id}.quantity`] &&
      !errors[`${line.id}.unitPrice`] &&
      lineAmount(line) === null
    )
      errors[`${line.id}.amount`] = "Line amount exceeds 9,999,999,999.99.";
  }
  if (!Object.keys(errors).length && invoicePreview(draft.items) === null)
    errors.items = "Invoice total exceeds 9,999,999,999.99.";
  return errors;
}
export function invoicePayload(draft: InvoiceDraft): CreateInvoicePayload {
  if (Object.keys(validateInvoice(draft)).length)
    throw new Error("Check the invoice fields before saving.");
  return {
    clientId: draft.clientId,
    issueDate: draft.issueDate,
    dueDate: draft.dueDate,
    ...(draft.notes.trim() ? { notes: draft.notes.trim() } : {}),
    items: draft.items.map((line) => ({
      description: line.description.trim(),
      quantity: Number(line.quantity),
      unitPrice: line.unitPrice,
    })),
  };
}

export function invoiceDraft(
  invoice: import("../types/invoice.types").InvoiceDetail,
): InvoiceDraft {
  return {
    clientId: invoice.clientId,
    issueDate: invoice.issueDate.slice(0, 10),
    dueDate: invoice.dueDate.slice(0, 10),
    notes: invoice.notes ?? "",
    items: invoice.items.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: String(item.quantity),
      unitPrice: item.unitPrice,
    })),
  };
}
export function draftActions(
  status: string | undefined,
  permissions: readonly Permission[],
) {
  return {
    edit: status === "DRAFT" && permissions.includes("invoices:update"),
    delete: status === "DRAFT" && permissions.includes("invoices:delete"),
  };
}

export function canIssueInvoice(
  status: string | undefined,
  permissions: readonly Permission[],
) {
  return status === "DRAFT" && permissions.includes("invoices:issue");
}

export function canDownloadInvoicePdf(
  status: string | undefined,
  permissions: readonly Permission[],
) {
  return status === "ISSUED" && permissions.includes("invoices:read");
}
