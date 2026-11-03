import { useState } from "react";
import type { Permission } from "@puffinpal/permissions";
import { FormField, FormModal } from "@/components/ui/form-modal";
import { formatExpenseMoney } from "@/features/expenses/utils";
import { useBillActivity } from "../hooks/use-bill-activity";
import { usePayableAction } from "../hooks/use-payable-action";
import {
  billTransitions,
  reasonError,
  reverseBillPayment,
  TRANSITION_LABELS,
} from "../services/bill-workflow-api";
import { BillPaymentsTable } from "../components/bill-payments-table";
import { BillTransitionDialog } from "./bill-transition-dialog";
import type {
  AccountsPayableApi,
  BillTransition,
  PayablePayment,
  VendorBillDetail,
} from "../types";

function auditReason(details: string | null) {
  if (!details) return "";
  try {
    const parsed: unknown = JSON.parse(details);
    return parsed &&
      typeof parsed === "object" &&
      "reason" in parsed &&
      typeof parsed.reason === "string"
      ? parsed.reason
      : "";
  } catch {
    return "";
  }
}
export function BillActivityDialog({
  id,
  api,
  permissions,
  onClose,
  onSaved,
  onEdit,
  onAttachments,
}: {
  id: string;
  api: AccountsPayableApi;
  permissions: readonly Permission[];
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
  onEdit: (bill: VendorBillDetail) => void;
  onAttachments: (bill: VendorBillDetail) => void;
}) {
  const activity = useBillActivity(api, id);
  const action = usePayableAction();
  const [transition, setTransition] = useState<BillTransition | null>(null);
  const [reversing, setReversing] = useState<PayablePayment | null>(null);
  const [reason, setReason] = useState("");
  const bill = activity.data?.bill;
  if (transition && bill)
    return (
      <BillTransitionDialog
        bill={bill}
        api={api}
        permissions={permissions}
        transition={transition}
        onClose={() => setTransition(null)}
        onSaved={async () => {
          await activity.refresh();
          await onSaved(`Bill ${TRANSITION_LABELS[transition].toLowerCase()} action completed.`);
        }}
      />
    );
  return (
    <FormModal
      title={bill ? `Bill ${bill.billNumber}` : "Bill details and history"}
      wide
      onClose={onClose}
      submitting={action.busy}
      submitLabel={reversing ? "Confirm payment reversal" : undefined}
      submitDisabled={!!reasonError(reason)}
      onSubmit={
        reversing
          ? () =>
              action.run(async () => {
                await reverseBillPayment(api, id, reversing, permissions, reason);
                setReversing(null);
                setReason("");
                await activity.refresh();
                await onSaved("Payment reversed. Bill balance and payment history refreshed.");
              })
          : undefined
      }
    >
      {activity.loading && <p role="status">Loading bill and payment history…</p>}
      {activity.error && (
        <p className="form-alert error" role="alert">
          {activity.error}
        </p>
      )}
      {action.error && (
        <p className="form-alert error" role="alert">
          {action.error} Reload the bill to check the latest payment status before retrying.
        </p>
      )}
      {!reversing && (
        <button
          className="button secondary compact"
          disabled={activity.loading || action.busy}
          onClick={() => {
            action.clearError();
            void activity.refresh();
          }}
        >
          Reload bill and history
        </button>
      )}
      {reversing ? (
        <section aria-label="Confirm payment reversal">
          <h3>Reverse this payment?</h3>
          <p>
            <strong>{formatExpenseMoney(reversing.amount, reversing.currency)}</strong> ·{" "}
            {reversing.paymentDate.slice(0, 10)} · {reversing.reference || "No reference"}
          </p>
          <p>
            The original payment remains in history and is marked reversed. The server will
            recalculate the outstanding bill balance and payables summary. Reverse any bank
            reconciliation first.
          </p>
          <FormField
            label="Reversal reason"
            hint={reasonError(reason) || "This reason is preserved in the payment history."}
          >
            <textarea
              required
              maxLength={500}
              disabled={action.busy}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </FormField>
          <button
            type="button"
            className="button secondary"
            disabled={action.busy}
            onClick={() => {
              setReversing(null);
              action.clearError();
            }}
          >
            Keep payment
          </button>
        </section>
      ) : (
        !activity.loading &&
        !activity.error &&
        bill &&
        activity.data && (
          <>
            <p>
              <strong>{bill.vendor.displayName || bill.vendor.name}</strong>
            </p>
            <p>
              <span className="status-pill">{bill.status.replaceAll("_", " ")}</span>{" "}
              <span className="status-pill neutral">
                {bill.settlementStatus.replaceAll("_", " ")}
              </span>
            </p>
            <p>
              Total: {formatExpenseMoney(bill.totalAmount, bill.currency)} · Payments applied:{" "}
              {formatExpenseMoney(bill.paidAmount, bill.currency)} · Outstanding:{" "}
              <strong>{formatExpenseMoney(bill.balance, bill.currency)}</strong>
            </p>
            {bill.submittedAt && <p>Last submitted: {bill.submittedAt.slice(0, 10)}</p>}
            {bill.approvedAt && <p>Approved: {bill.approvedAt.slice(0, 10)}</p>}
            {bill.rejectionReason && (
              <p role="note">
                <strong>
                  {bill.status === "REJECTED" ? "Rejection reason" : "Previous rejection reason"}:
                </strong>{" "}
                {bill.rejectionReason}
              </p>
            )}
            {bill.status === "REJECTED" && (
              <p>
                Review the rejection reason before resubmitting. You can correct attachments on a
                rejected bill. Bill fields and lines can only be edited in Draft; reopening a
                rejected bill as a draft is not supported.
              </p>
            )}
            <div className="row-actions">
              {bill.status === "DRAFT" && permissions.includes("accounts-payable:manage") && (
                <button className="button secondary compact" onClick={() => onEdit(bill)}>
                  Edit draft
                </button>
              )}
              <button className="button secondary compact" onClick={() => onAttachments(bill)}>
                Attachment
              </button>
              {billTransitions(bill, permissions).map((value) => (
                <button
                  className="button secondary compact"
                  key={value}
                  onClick={() => setTransition(value)}
                >
                  {TRANSITION_LABELS[value]} bill
                </button>
              ))}
            </div>
            {bill.status === "APPROVED" && bill.settlementStatus !== "UNPAID" && (
              <p>Reverse active payments before voiding this bill.</p>
            )}
            <h3>Payment history</h3>
            <BillPaymentsTable
              payments={activity.data.payments}
              permissions={permissions}
              busy={action.busy}
              onReverse={(payment) => {
                action.clearError();
                setReason("");
                setReversing(payment);
              }}
            />
            <h3>Bill approval and edit history</h3>
            {bill.audit.length ? (
              <ul>
                {[...bill.audit]
                  .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
                  .map((event) => (
                    <li key={event.id}>
                      {event.createdAt.slice(0, 10)} · {event.action.replaceAll("_", " ")} · User{" "}
                      {event.actorId}
                      {auditReason(event.details) ? ` · ${auditReason(event.details)}` : ""}
                    </li>
                  ))}
              </ul>
            ) : (
              <p>No bill activity recorded.</p>
            )}
          </>
        )
      )}
    </FormModal>
  );
}
