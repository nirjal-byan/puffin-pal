import { useState } from "react";
import type { Permission } from "@puffinpal/permissions";
import { FormField, FormModal } from "@/components/ui/form-modal";
import { usePayableAction } from "../hooks/use-payable-action";
import {
  billTransitions,
  reasonError,
  TRANSITION_LABELS,
  transitionBill,
} from "../services/bill-workflow-api";
import type { AccountsPayableApi, BillTransition, VendorBill, VendorBillDetail } from "../types";

export function BillTransitionDialog({
  bill,
  transition,
  api,
  permissions,
  onClose,
  onSaved,
}: {
  bill: VendorBill;
  transition: BillTransition;
  api: AccountsPayableApi;
  permissions: readonly Permission[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [currentBill, setCurrentBill] = useState(bill);
  const available = billTransitions(currentBill, permissions).includes(transition);
  const [reason, setReason] = useState("");
  const action = usePayableAction();
  const label = TRANSITION_LABELS[transition];
  const invalid = transition === "reject" ? reasonError(reason) : "";
  return (
    <FormModal
      title={`${label} bill?`}
      onClose={onClose}
      submitting={action.busy}
      submitLabel={`${label} bill`}
      submitDisabled={!!invalid || !available}
      onSubmit={() =>
        action.run(async () => {
          await transitionBill(api, currentBill, transition, permissions, reason);
          await onSaved();
          onClose();
        })
      }
    >
      <p>
        <strong>{currentBill.billNumber}</strong> · Current status:{" "}
        {currentBill.status.replaceAll("_", " ")}
      </p>
      {transition === "void" ? (
        <p>
          Voiding removes this approved bill from outstanding payables and preserves its history.
          Reverse all recorded payments first. This action cannot be undone.
        </p>
      ) : (
        <p>
          Confirm that this bill is ready to{" "}
          {transition === "resubmit"
            ? "return for approval"
            : transition === "reject"
              ? "be returned to its preparer"
              : transition === "approve"
                ? "be approved for payment"
                : "be submitted for approval"}
          .
        </p>
      )}
      {transition === "reject" && (
        <FormField label="Rejection reason" hint={invalid || "The preparer will see this reason."}>
          <textarea
            required
            maxLength={500}
            disabled={action.busy}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </FormField>
      )}
      {!available && (
        <p role="alert">
          This action is no longer available for the current bill status or your permissions.
        </p>
      )}
      <button
        type="button"
        className="button secondary compact"
        disabled={action.busy}
        onClick={() =>
          void action.run(async () => {
            setCurrentBill(
              await api<VendorBillDetail>(
                `/accounts-payable/bills/${bill.id}?includeHistory=false`,
              ),
            );
          })
        }
      >
        Reload latest bill
      </button>
      {action.error && (
        <p role="alert" className="form-alert error">
          {action.error} Reload the bill before retrying if its status or version changed.
        </p>
      )}
    </FormModal>
  );
}
