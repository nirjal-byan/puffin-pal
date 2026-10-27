import { AppModal } from "@/components/ui/app-modal";
import type { Expense } from "../types";
import type { ExpenseWorkflowAction } from "./expenses-table";

export interface ExpenseWorkflow {
  expense: Expense;
  action: ExpenseWorkflowAction;
}
export function ExpenseWorkflowDialog({
  workflow,
  reason,
  busy,
  onReasonChange,
  onClose,
  onConfirm,
}: {
  workflow: ExpenseWorkflow;
  reason: string;
  busy: boolean;
  onReasonChange: (reason: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const titles = {
    reject: "Reject expense",
    approve: "Approve expense",
    reopen: "Revise expense",
    submit: "Submit expense",
  };
  const messages = {
    submit: "Send this expense for review? It cannot be edited while pending.",
    approve: "Approve this expense for financial reporting?",
    reopen: "Reopen this rejected expense as an editable draft?",
    reject: "Explain what needs to be corrected.",
  };
  return (
    <AppModal title={titles[workflow.action]} onClose={onClose}>
      <div className="expense-workflow-dialog">
        <p>{messages[workflow.action]}</p>
        {workflow.action === "reject" && (
          <label>
            Reason
            <textarea
              autoFocus
              required
              maxLength={1000}
              value={reason}
              onChange={(event) => onReasonChange(event.target.value)}
            />
          </label>
        )}
        <div className="invoice-actions">
          <button className="button secondary" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button
            className={workflow.action === "reject" ? "button danger" : "button primary"}
            disabled={busy || (workflow.action === "reject" && !reason.trim())}
            onClick={onConfirm}
          >
            {busy ? "Saving…" : "Confirm"}
          </button>
        </div>
      </div>
    </AppModal>
  );
}
