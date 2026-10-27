import { Dropdown } from "@/components/ui/dropdown";
import {
  FormCheckbox,
  FormField,
  FormModal,
  FormModalIntro,
  FormModalSection,
} from "@/components/ui/form-modal";
import { BANKING_CURRENCIES } from "./constants";
import type { BankAccountForm } from "./types";

export function BankAccountDialog({
  account,
  busy,
  onChange,
  onClose,
  onSubmit,
}: {
  account: BankAccountForm;
  busy: boolean;
  onChange: (account: BankAccountForm) => void;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
}) {
  return (
    <FormModal
      title="Add bank account"
      badge="Banking"
      wide
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel="Add account"
      submitting={busy}
    >
      <FormModalIntro icon="▰" title="Account details">
        Store only a recognizable name and masked identifier. PuffinPal never asks for
        online-banking credentials.
      </FormModalIntro>
      <FormModalSection title="Identification" description="Visible to authorized finance users">
        <div className="standard-form-grid">
          <FormField label="Account name">
            <input
              required
              value={account.displayName}
              onChange={(e) => onChange({ ...account, displayName: e.target.value })}
              placeholder="Operating account"
            />
          </FormField>
          <FormField label="Bank">
            <input
              required
              value={account.bankName}
              onChange={(e) => onChange({ ...account, bankName: e.target.value })}
              placeholder="Bank name"
            />
          </FormField>
          <FormField label="Account holder">
            <input
              required
              value={account.accountHolder}
              onChange={(e) => onChange({ ...account, accountHolder: e.target.value })}
            />
          </FormField>
          <FormField label="Masked identifier" hint="Example: •••• 4821">
            <input
              required
              value={account.maskedIdentifier}
              onChange={(e) => onChange({ ...account, maskedIdentifier: e.target.value })}
              placeholder="•••• 4821"
            />
          </FormField>
          <FormField label="Currency">
            <Dropdown
              name="account-currency"
              label="Currency"
              searchable={false}
              value={account.currency}
              onChange={(currency) => onChange({ ...account, currency })}
              options={BANKING_CURRENCIES.map((value) => ({ value, label: value }))}
            />
          </FormField>
          <FormField label="Country code">
            <input
              required
              maxLength={2}
              value={account.countryCode}
              onChange={(e) => onChange({ ...account, countryCode: e.target.value.toUpperCase() })}
            />
          </FormField>
        </div>
      </FormModalSection>
      <FormCheckbox
        checked={account.isDefault}
        onChange={(isDefault) => onChange({ ...account, isDefault })}
        label="Use as the default bank account"
        description="New statement imports will select this account first."
      />
    </FormModal>
  );
}
