import type {
  AccountsPayableApi,
  BillFormValue,
  Vendor,
  VendorBillDetail,
  VendorFormValue,
} from "../types";

export const emptyVendor = (): VendorFormValue => ({
  name: "",
  displayName: "",
  email: "",
  phone: "",
  website: "",
  address: "",
  country: "",
  taxId: "",
  notes: "",
  defaultCurrency: "USD",
  paymentTermsDays: 30,
});
export const emptyBillItem = () => ({
  description: "",
  quantity: "1",
  unitPrice: "0.00",
  taxAmount: "0.00",
  discountAmount: "0.00",
});
export const emptyBill = (): BillFormValue => ({
  vendorId: "",
  billNumber: "",
  vendorReference: "",
  expenseId: "",
  issueDate: new Date().toISOString().slice(0, 10),
  dueDate: "",
  currency: "USD",
  description: "",
  items: [emptyBillItem()],
});
export const canEditBill = (status: string) => status === "DRAFT";
export const canChangeAttachment = (status: string) => ["DRAFT", "REJECTED"].includes(status);
export function vendorValues(vendor: Vendor): VendorFormValue {
  const result = emptyVendor();
  for (const key of Object.keys(result) as (keyof VendorFormValue)[]) {
    Object.assign(result, { [key]: vendor[key] ?? result[key] });
  }
  return result;
}
export function billValues(bill: VendorBillDetail): BillFormValue {
  return {
    vendorId: bill.vendorId,
    billNumber: bill.billNumber,
    vendorReference: bill.vendorReference ?? "",
    expenseId: bill.expenseId ?? "",
    issueDate: bill.issueDate.slice(0, 10),
    dueDate: bill.dueDate.slice(0, 10),
    currency: bill.currency,
    description: bill.description ?? "",
    items: [...bill.items]
      .sort((a, b) => a.position - b.position)
      .map(({ description, quantity, unitPrice, taxAmount, discountAmount }) => ({
        description,
        quantity,
        unitPrice,
        taxAmount,
        discountAmount,
      })),
  };
}
function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function validateBill(value: BillFormValue): string {
  if (!value.vendorId || !value.billNumber.trim() || value.billNumber.trim().length > 80)
    return "Choose a vendor and enter a bill number of up to 80 characters.";
  if (!validDate(value.issueDate) || !validDate(value.dueDate) || value.dueDate < value.issueDate)
    return "Choose valid dates; the due date cannot precede the issue date.";
  if (!value.items.length) return "Add at least one bill line.";
  for (const [index, item] of value.items.entries()) {
    if (!item.description.trim() || item.description.trim().length > 500)
      return `Line ${index + 1}: enter a description of up to 500 characters.`;
    if (!/^\d{1,8}(\.\d{1,4})?$/.test(item.quantity))
      return `Line ${index + 1}: quantity must be non-negative with up to four decimal places.`;
    for (const field of ["unitPrice", "taxAmount", "discountAmount"] as const) {
      if (!/^\d{1,12}(\.\d{1,2})?$/.test(item[field]))
        return `Line ${index + 1}: amounts must be non-negative with up to two decimal places.`;
    }
    // Exact arithmetic mirrors the backend's rounding for validation only.
    const scaled = (s: string, places: number) => {
      const [whole, fraction = ""] = s.split(".");
      return BigInt(whole!) * 10n ** BigInt(places) + BigInt(fraction.padEnd(places, "0"));
    };
    if (
      scaled(item.discountAmount, 2) >
      (scaled(item.quantity, 4) * scaled(item.unitPrice, 2) + 5000n) / 10000n +
        scaled(item.taxAmount, 2)
    )
      return `Line ${index + 1}: discount exceeds the amount and tax.`;
  }
  return "";
}
export function validateVendor(value: VendorFormValue) {
  if (!value.name.trim() || value.name.trim().length > 160)
    return "Enter a vendor name of up to 160 characters.";
  if (
    !Number.isInteger(value.paymentTermsDays) ||
    value.paymentTermsDays < 0 ||
    value.paymentTermsDays > 365
  )
    return "Payment terms must be a whole number between 0 and 365 days.";
  if (value.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email.trim()))
    return "Enter a valid email address.";
  return "";
}
export function archiveVendor(api: AccountsPayableApi, id: string) {
  return api(`/vendors/${id}/archive`, { method: "POST" });
}
export function saveVendor(
  api: AccountsPayableApi,
  value: VendorFormValue,
  vendor?: Vendor | null,
) {
  const error = validateVendor(value);
  if (error) throw new Error(error);
  return api(vendor ? `/vendors/${vendor.id}` : "/vendors", {
    method: vendor ? "PATCH" : "POST",
    body: { ...value, ...(vendor ? { expectedVersion: vendor.version } : {}) },
  });
}
export function saveBill(
  api: AccountsPayableApi,
  value: BillFormValue,
  bill?: VendorBillDetail | null,
) {
  const error = validateBill(value);
  if (error) throw new Error(error);
  if (bill && !canEditBill(bill.status)) throw new Error("Only draft bills can be edited.");
  return api(bill ? `/accounts-payable/bills/${bill.id}` : "/accounts-payable/bills", {
    method: bill ? "PATCH" : "POST",
    body: {
      ...value,
      expenseId: value.expenseId || undefined,
      ...(bill ? { expectedVersion: bill.version } : {}),
    },
  });
}
export function validateAttachment(file: Pick<File, "size" | "type">) {
  if (!["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(file.type))
    return "Use a PDF, JPEG, PNG, or WebP attachment.";
  if (!file.size || file.size > 5 * 1024 * 1024)
    return "Choose a non-empty attachment of 5 MB or smaller.";
  return "";
}
export async function uploadBillAttachment(
  api: AccountsPayableApi,
  bill: VendorBillDetail,
  file: File,
) {
  if (!canChangeAttachment(bill.status))
    throw new Error("Attachments can only be changed on draft or rejected bills.");
  const error = validateAttachment(file);
  if (error) throw new Error(error);
  const body = new FormData();
  body.set("attachment", file);
  return api(`/accounts-payable/bills/${bill.id}/attachment`, { method: "PUT", body });
}
export function removeBillAttachment(api: AccountsPayableApi, bill: VendorBillDetail) {
  if (!canChangeAttachment(bill.status))
    throw new Error("This attachment is a historical record and cannot be removed.");
  return api(`/accounts-payable/bills/${bill.id}/attachment`, { method: "DELETE" });
}
export function downloadBillAttachment(api: AccountsPayableApi, id: string) {
  return api<Blob>(`/accounts-payable/bills/${id}/attachment`, { responseType: "file" });
}
