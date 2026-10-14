import { BadRequestException } from "@nestjs/common";
import type { Numeric } from "@prisma/orm-postgres/target/codec-types";
import { EXPENSE_AMOUNT_PATTERN } from "./expense.dto.js";

export function expenseAmount(value: string): Numeric<12, 2> {
  if (!EXPENSE_AMOUNT_PATTERN.test(value)) throw new BadRequestException("Amount must be a positive decimal with at most two decimal places");
  const [whole, fraction = ""] = value.split(".");
  const cents = BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (cents <= 0n) throw new BadRequestException("Amount must be greater than zero");
  if (cents > 999999999999n) throw new BadRequestException("Amount exceeds Numeric(12,2) capacity");
  return `${cents / 100n}.${(cents % 100n).toString().padStart(2, "0")}` as Numeric<12, 2>;
}
