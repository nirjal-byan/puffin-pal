import { useEffect, useState } from "react";
import type { AccountsPayableApi } from "../types";
import type { Expense } from "@/features/expenses/types";
import { expenseHref } from "@/features/expenses/services/settlement-api";
import { formatExpenseMoney } from "@/features/expenses/utils";

export function LinkedExpense({
  id,
  api,
  canRead,
}: {
  id: string;
  api: AccountsPayableApi;
  canRead: boolean;
}) {
  const [expense, setExpense] = useState<Expense | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!canRead) return;
    const controller = new AbortController();
    void api<Expense>(`/expenses/${encodeURIComponent(id)}`, { signal: controller.signal })
      .then((value) => {
        if (!controller.signal.aborted) setExpense(value);
      })
      .catch((failure) => {
        if (!controller.signal.aborted)
          setError(failure instanceof Error ? failure.message : "Linked expense unavailable.");
      });
    return () => controller.abort();
  }, [api, id, canRead]);
  if (!canRead)
    return <p>This bill has a linked expense. Expense read permission is required to view it.</p>;
  if (error) return <p role="alert">Linked expense unavailable: {error}</p>;
  if (!expense) return <p role="status">Loading linked expense…</p>;
  return (
    <section aria-label="Linked expense">
      <h3>Linked expense</h3>
      <a href={expenseHref(id)}>{expense.title}</a>
      <p>
        Expense approval: {expense.approvalStatus.replaceAll("_", " ")}. Payments are recorded
        against this bill.
      </p>
      {expense.settlement && (
        <p>
          Settlement: {expense.settlement.settlementStatus.replaceAll("_", " ")} · Outstanding
          obligation: {formatExpenseMoney(expense.settlement.balance, expense.settlement.currency)}
        </p>
      )}
    </section>
  );
}
