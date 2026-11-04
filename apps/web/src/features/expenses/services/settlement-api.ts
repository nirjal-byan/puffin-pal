import type { Permission } from "@puffinpal/permissions";
import type { AccountsPayableApi, PayablePayment } from "../../accounts-payable/types";
import type { ExpenseSettlement, ExpenseSettlementInput } from "../types";

export const expenseHref = (id: string) =>
  `/?section=expenses&area=workspace&expense=${encodeURIComponent(id)}`;
export const billHref = (id: string) =>
  `/?section=accounts-payable&area=finance&bill=${encodeURIComponent(id)}`;
export function validateSettlement(input: ExpenseSettlementInput, balance: string) {
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(input.amount))
    return "Enter a positive amount with up to two decimal places.";
  const cents = (value: string) => {
    const [whole, fraction = ""] = value.split(".");
    return BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, "0"));
  };
  if (cents(input.amount) <= 0n || cents(input.amount) > cents(balance))
    return "Amount must be greater than zero and cannot exceed the outstanding balance.";
  const date = new Date(`${input.paymentDate}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(input.paymentDate) ||
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== input.paymentDate
  )
    return "Choose a valid settlement date.";
  return "";
}
export function canSettleExpense(
  settlement: ExpenseSettlement,
  permissions: readonly Permission[],
) {
  return (
    !settlement.linked &&
    settlement.approvalStatus === "APPROVED" &&
    settlement.settlementStatus !== "PAID" &&
    permissions.includes("expenses:pay")
  );
}
export function settleExpense(
  api: AccountsPayableApi,
  settlement: ExpenseSettlement,
  input: ExpenseSettlementInput,
  permissions: readonly Permission[],
  idempotencyKey: string,
) {
  if (!canSettleExpense(settlement, permissions))
    throw new Error(
      "Only approved, unlinked expenses can be settled with expense payment permission.",
    );
  const error = validateSettlement(input, settlement.balance);
  if (error) throw new Error(error);
  return api(`/expenses/${settlement.expenseId}/payments`, {
    method: "POST",
    body: { ...input, idempotencyKey },
  });
}
export function reverseExpensePayment(
  api: AccountsPayableApi,
  settlement: ExpenseSettlement,
  payment: PayablePayment,
  reason: string,
  permissions: readonly Permission[],
) {
  if (
    payment.targetType !== "EXPENSE" ||
    payment.expenseId !== settlement.expenseId ||
    payment.reversedAt ||
    !permissions.includes("expenses:pay")
  )
    throw new Error("This payment cannot be reversed from the expense workflow.");
  if (!reason.trim() || reason.trim().length > 500)
    throw new Error("Enter a reversal reason of 1–500 characters.");
  return api(`/expense-payments/${payment.id}/reverse`, {
    method: "POST",
    body: { reason: reason.trim(), expectedVersion: payment.version },
  });
}
