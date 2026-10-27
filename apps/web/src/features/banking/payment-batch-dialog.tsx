import { Dropdown } from "@/components/ui/dropdown";
import { FormField, FormModal, FormModalIntro, FormModalSection } from "@/components/ui/form-modal";
import type { BankAccount, PayrollObligation } from "./types";

export function PaymentBatchDialog({
  accounts,
  obligations,
  accountId,
  name,
  selected,
  busy,
  onAccountChange,
  onNameChange,
  onSelectedChange,
  onClose,
  onSubmit,
}: {
  accounts: BankAccount[];
  obligations: PayrollObligation[];
  accountId: string;
  name: string;
  selected: string[];
  busy: boolean;
  onAccountChange: (id: string) => void;
  onNameChange: (name: string) => void;
  onSelectedChange: (ids: string[]) => void;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
}) {
  return (
    <FormModal
      title="Create payroll payment batch"
      badge="Payroll"
      wide
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel="Create batch"
      submitting={busy}
      submitDisabled={!name.trim() || !selected.length}
    >
      <FormModalIntro icon="$" title="Prepare a payment checklist">
        This does not move money. It groups finalized, unpaid payroll entries for controlled
        processing.
      </FormModalIntro>
      <FormModalSection title="Batch details">
        <div className="standard-form-grid">
          <FormField label="Batch name">
            <input
              required
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder="October payroll payments"
            />
          </FormField>
          <FormField label="Bank account" optional>
            <Dropdown
              name="batch-account"
              label="Bank account"
              value={accountId}
              onChange={onAccountChange}
              options={accounts
                .filter((account) => account.isActive)
                .map((account) => ({ value: account.id, label: account.displayName }))}
            />
          </FormField>
        </div>
      </FormModalSection>
      <FormModalSection
        title="Eligible obligations"
        description="Select entries from one finalized pay run"
      >
        <div className="obligation-list">
          {obligations.map((item) => {
            const incompatible =
              selected.length > 0 &&
              obligations.find((row) => row.id === selected[0])?.payrollRunId !== item.payrollRunId;
            return (
              <label key={item.id}>
                <input
                  type="checkbox"
                  disabled={incompatible}
                  checked={selected.includes(item.id)}
                  onChange={(event) =>
                    onSelectedChange(
                      event.target.checked
                        ? [...selected, item.id]
                        : selected.filter((id) => id !== item.id),
                    )
                  }
                />
                <span>
                  <strong>{item.employeeName}</strong>
                  <small>
                    {item.payrollRunName} · due {item.paymentDate}
                  </small>
                </span>
                <b>
                  {item.currency} {item.amount}
                </b>
              </label>
            );
          })}
          {!obligations.length && (
            <p className="muted">No finalized unpaid payroll entries are available.</p>
          )}
        </div>
      </FormModalSection>
    </FormModal>
  );
}
