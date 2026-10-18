import type { Numeric } from "@prisma/orm-postgres/target/codec-types";
import { BadRequestException } from "@nestjs/common";
import { UNIT_PRICE_PATTERN, type CreateInvoiceItemDto } from "../dto/create-invoice.dto.js";
const MAX_CENTS = 999999999999n;
export function decimalFromCents(cents: bigint): Numeric<12, 2> {
  if (cents < 0n || cents > MAX_CENTS)
    throw new BadRequestException("Amount exceeds Numeric(12,2) capacity");
  return `${cents / 100n}.${(cents % 100n).toString().padStart(2, "0")}` as Numeric<12, 2>;
}
export function calculateInvoice(items: readonly CreateInvoiceItemDto[]) {
  if (!items.length || items.length > 100)
    throw new BadRequestException("Provide between 1 and 100 invoice items");
  let subtotal = 0n;
  const calculatedItems = items.map((item) => {
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 2147483647)
      throw new BadRequestException("Quantity must be a positive 32-bit integer");
    if (typeof item.unitPrice !== "string" || !UNIT_PRICE_PATTERN.test(item.unitPrice))
      throw new BadRequestException(
        "Unit price must be a nonnegative decimal string with at most two decimal places",
      );
    if (
      typeof item.description !== "string" ||
      !item.description.trim() ||
      item.description.length > 1000
    )
      throw new BadRequestException(
        "Item description is required and must be at most 1000 characters",
      );
    const [whole, fractional = ""] = item.unitPrice.split(".");
    const price = BigInt(whole!) * 100n + BigInt(fractional.padEnd(2, "0"));
    const amount = price * BigInt(item.quantity);
    if (amount > MAX_CENTS)
      throw new BadRequestException("Line item amount exceeds Numeric(12,2) capacity");
    subtotal += amount;
    if (subtotal > MAX_CENTS)
      throw new BadRequestException("Invoice total exceeds Numeric(12,2) capacity");
    return {
      description: item.description.trim(),
      quantity: item.quantity,
      unitPrice: decimalFromCents(price),
      amount: decimalFromCents(amount),
    };
  });
  return {
    items: calculatedItems,
    subtotal: decimalFromCents(subtotal),
    tax: decimalFromCents(0n),
    total: decimalFromCents(subtotal),
  };
}
