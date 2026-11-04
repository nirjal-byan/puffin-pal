import { useCallback, useEffect, useRef, useState } from "react";
import type { Permission } from "@puffinpal/permissions";
import { DatePicker } from "@/components/ui/date-picker";
import { Dropdown } from "@/components/ui/dropdown";
import { FormField, FormModal } from "@/components/ui/form-modal";
import { usePayableAction } from "@/features/accounts-payable/hooks/use-payable-action";
import { BillPaymentsTable } from "@/features/accounts-payable/components/bill-payments-table";
import type { AccountsPayableApi, PayablePayment } from "@/features/accounts-payable/types";
import {
  billHref,
  canSettleExpense,
  reverseExpensePayment,
  settleExpense,
  validateSettlement,
} from "../services/settlement-api";
import type { ExpenseSettlement, ExpenseSettlementInput } from "../types";
import { formatExpenseMoney } from "../utils";

export function ExpenseSettlementDialog({
  id,
  api,
  permissions,
  onClose,
  onSaved,
}: {
  id: string;
  api: AccountsPayableApi;
  permissions: readonly Permission[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [settlement, setSettlement] = useState<ExpenseSettlement | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [recording, setRecording] = useState(false);
  const [reversing, setReversing] = useState<PayablePayment | null>(null);
  const [reason, setReason] = useState("");
  const [input, setInput] = useState<ExpenseSettlementInput>({
    amount: "",
    paymentDate: new Date().toISOString().slice(0, 10),
    method: "BANK_TRANSFER",
    reference: "",
  });
  // Keep this key on failure (including a lost response); only a new confirmed payment gets a new key.
  const key = useRef("");
  const request = useRef<AbortController | null>(null);
  const action = usePayableAction();
  const refresh = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setFailure("");
    try {
      const next = await api<ExpenseSettlement>(`/expenses/${id}/settlement`, {
        signal: controller.signal,
      });
      if (!controller.signal.aborted) setSettlement(next);
    } catch (error) {
      if (!controller.signal.aborted)
        setFailure(error instanceof Error ? error.message : "Could not load settlement.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [api, id]);
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void refresh();
    });
    return () => {
      active = false;
      request.current?.abort();
    };
  }, [refresh]);
  const submit =
    recording || reversing
      ? () =>
          action.run(async () => {
            if (!settlement) return;
            if (reversing)
              await reverseExpensePayment(api, settlement, reversing, reason, permissions);
            else {
              const invalid = validateSettlement(input, settlement.balance);
              if (invalid) throw new Error(invalid);
              setAttempted(true);
              await settleExpense(api, settlement, input, permissions, key.current);
            }
            setRecording(false);
            setReversing(null);
            key.current = "";
            await refresh();
            await onSaved();
          })
      : undefined;
  return (
    <FormModal
      title="Expense settlement"
      wide
      onClose={onClose}
      onSubmit={submit}
      submitLabel={reversing ? "Confirm reversal" : recording ? "Record settlement" : undefined}
      submitting={action.busy}
    >
      {loading && <p role="status">Loading settlement…</p>}
      {failure && (
        <p role="alert" className="form-alert error">
          {failure}
        </p>
      )}
      {action.error && (
        <p role="alert" className="form-alert error">
          {action.error}
        </p>
      )}
      {recording && attempted && (
        <p>
          The submitted payment details are fixed for retry. If the result is uncertain, close this
          dialog and reload settlement history before starting another payment.
        </p>
      )}
      {!recording && !reversing && (
        <button
          className="button secondary compact"
          disabled={loading || action.busy}
          onClick={() => void refresh()}
        >
          Reload settlement
        </button>
      )}
      {!loading && !failure && settlement && (
        <>
          <p>
            Expense approval: <strong>{settlement.approvalStatus.replaceAll("_", " ")}</strong> ·
            Settlement: <strong>{settlement.settlementStatus.replaceAll("_", " ")}</strong>
          </p>
          <p>
            {settlement.linked ? "Bill obligation" : "Expense amount"}:{" "}
            {formatExpenseMoney(settlement.totalAmount, settlement.currency)} · Payments applied:{" "}
            {formatExpenseMoney(settlement.paidAmount, settlement.currency)} · Outstanding:{" "}
            <strong>{formatExpenseMoney(settlement.balance, settlement.currency)}</strong>
          </p>
          {settlement.linked && (
            <p>
              This expense is settled through its linked bill. Record and reverse payments on that
              bill to avoid a second settlement.{" "}
              {settlement.linkedBill ? (
                <a href={billHref(settlement.linkedBill.id)}>
                  Open bill {settlement.linkedBill.billNumber} (
                  {settlement.linkedBill.status.replaceAll("_", " ")})
                </a>
              ) : (
                "Bill details require Accounts Payable read permission."
              )}
            </p>
          )}
          {settlement.linked && (
            <p>
              Recorded expense cost:{" "}
              {formatExpenseMoney(settlement.expenseAmount, settlement.expenseCurrency)}. The bill
              balance above follows its own amount and currency; no conversion is performed.
            </p>
          )}
          <p>
            Approved expense costs use the expense date. Settlement cash outflows use payment dates;
            reversals preserve history and remove the payment from active cash totals.
          </p>
          <p>
            The Overview expense and net cash flow cards use approved expense costs. Cash movement
            reports use settlement payments.
          </p>
          {recording ? (
            <fieldset disabled={action.busy || attempted} style={{ border: 0 }}>
              <FormField label="Settlement amount">
                <input
                  required
                  inputMode="decimal"
                  value={input.amount}
                  onChange={(event) => setInput({ ...input, amount: event.target.value })}
                />
              </FormField>
              <FormField label="Payment date">
                <DatePicker
                  ariaLabel="Expense settlement date"
                  value={input.paymentDate}
                  onChange={(paymentDate) => setInput({ ...input, paymentDate })}
                />
              </FormField>
              <FormField label="Method">
                <Dropdown
                  name="expense-payment-method"
                  label="Payment method"
                  value={input.method}
                  onChange={(method) => setInput({ ...input, method })}
                  options={["BANK_TRANSFER", "CASH", "CARD", "CHEQUE", "OTHER"].map((value) => ({
                    value,
                    label: value.replaceAll("_", " "),
                  }))}
                />
              </FormField>
              <FormField label="Reference" optional>
                <input
                  maxLength={120}
                  value={input.reference}
                  onChange={(event) => setInput({ ...input, reference: event.target.value })}
                />
              </FormField>
              <p>Record a payment already made. This does not initiate a bank transfer.</p>
            </fieldset>
          ) : reversing ? (
            <section>
              <h3>
                Reverse {formatExpenseMoney(reversing.amount, reversing.currency)} paid{" "}
                {reversing.paymentDate.slice(0, 10)}?
              </h3>
              <p>
                The original payment stays in history and the server restores the outstanding
                balance. Reverse any bank reconciliation first.
              </p>
              <FormField label="Reversal reason">
                <textarea
                  required
                  maxLength={500}
                  disabled={action.busy}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </FormField>
            </section>
          ) : (
            <>
              {canSettleExpense(settlement, permissions) && (
                <button
                  className="button primary"
                  onClick={() => {
                    setAttempted(false);
                    key.current = crypto.randomUUID();
                    setInput((value) => ({ ...value, amount: settlement.balance }));
                    action.clearError();
                    setRecording(true);
                  }}
                >
                  Record settlement
                </button>
              )}
              {!settlement.linked && settlement.approvalStatus !== "APPROVED" && (
                <p>Only approved expenses can be settled.</p>
              )}
              {settlement.linked && !!settlement.directPayments?.length && (
                <>
                  <p>
                    Earlier direct expense payments are preserved below. Review active entries and
                    reverse them before paying the linked bill.
                  </p>
                  <BillPaymentsTable
                    caption="Earlier direct expense payments"
                    payments={settlement.directPayments}
                    permissions={permissions}
                    busy={action.busy}
                    canReverse={(payment) =>
                      !payment.reversedAt && permissions.includes("expenses:pay")
                    }
                    onReverse={(payment) => {
                      action.clearError();
                      setReason("");
                      setReversing(payment);
                    }}
                  />
                </>
              )}
              <BillPaymentsTable
                caption="Expense settlement history"
                emptyMessage="No settlement payments recorded."
                payments={settlement.payments}
                permissions={permissions}
                busy={action.busy}
                canReverse={(payment) =>
                  !settlement.linked && !payment.reversedAt && permissions.includes("expenses:pay")
                }
                onReverse={(payment) => {
                  action.clearError();
                  setReason("");
                  setReversing(payment);
                }}
              />
            </>
          )}
        </>
      )}
    </FormModal>
  );
}
