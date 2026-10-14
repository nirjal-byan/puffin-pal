export const RECEIPT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
export function validateExpense(input: { title: string; amount: string; date: string }) {
  if (!input.title.trim() || input.title.length > 160) return "Enter an expense title.";
  if (!/^(?:0*[0-9]{1,10})(?:\.[0-9]{1,2})?$/.test(input.amount)) return "Enter a positive amount with up to two decimal places.";
  const [whole, fraction = ""] = input.amount.split(".");
  if (BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, "0")) <= 0n) return "Amount must be greater than zero.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || Number.isNaN(Date.parse(`${input.date}T00:00:00Z`))) return "Choose a valid expense date.";
  return "";
}
export function validateReceiptFile(file: Pick<File, "type" | "size">) {
  if (!(RECEIPT_TYPES as readonly string[]).includes(file.type)) return "Receipt must be a JPEG, PNG, WebP or PDF.";
  if (file.size > MAX_RECEIPT_BYTES) return "Receipt must be 5 MB or smaller.";
  return "";
}
