import { FormModal, FormModalIntro, FormModalSection } from "@/components/ui/form-modal";
import type { BankTransaction, ReconciliationCandidate } from "../types";

export function ReconciliationDialog({
  transaction,
  candidates,
  selected,
  busy,
  onSelected,
  onClose,
  onSubmit,
}: {
  transaction: BankTransaction;
  candidates: ReconciliationCandidate[];
  selected: string;
  busy: boolean;
  onSelected: (id: string) => void;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
}) {
  return (
    <FormModal
      title="Match bank transaction"
      badge="Reconciliation"
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel="Confirm match"
      submitting={busy}
      submitDisabled={!selected}
    >
      <FormModalIntro
        icon="✓"
        title={`${transaction.currency} ${transaction.amount} · ${transaction.description}`}
      >
        Only unreconciled payment records with the same amount, direction, and currency are shown.
      </FormModalIntro>
      <FormModalSection title="Suggested records">
        {candidates.length ? (
          <div className="match-options">
            {candidates.map((item) => (
              <label key={item.targetId} className={selected === item.targetId ? "selected" : ""}>
                <input
                  type="radio"
                  name="candidate"
                  checked={selected === item.targetId}
                  onChange={() => onSelected(item.targetId)}
                />
                <span>
                  <strong>{item.label}</strong>
                  <small>
                    {item.date} · {item.reference || "No reference"}
                  </small>
                </span>
                <b>{item.amount}</b>
              </label>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h3>No exact matches</h3>
            <p>Record the corresponding payment first, or verify the amount and currency.</p>
          </div>
        )}
      </FormModalSection>
    </FormModal>
  );
}
