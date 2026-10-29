import { Dropdown } from "@/components/ui/dropdown";
import { FormField, FormModal, FormModalIntro, FormModalSection } from "@/components/ui/form-modal";
import { PAYABLE_CURRENCY_OPTIONS } from "../constants";
import type { VendorFormValue } from "../types";
export function VendorDialog({
  value,
  onChange,
  onClose,
  onSubmit,
}: {
  value: VendorFormValue;
  onChange: (value: VendorFormValue) => void;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
}) {
  return (
    <FormModal
      title="Add vendor"
      badge="Purchasing"
      wide
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel="Add vendor"
      submitDisabled={!value.name.trim()}
    >
      <FormModalIntro icon="◉" title="Supplier details">
        Keep purchasing contacts and payment defaults in one place.
      </FormModalIntro>
      <FormModalSection title="Vendor profile" description="Contact and payment defaults">
        <div className="standard-form-grid">
          <label className="form-field">
            <span>Vendor name</span>
            <input
              required
              value={value.name}
              onChange={(event) => onChange({ ...value, name: event.target.value })}
            />
          </label>
          <FormField label="Email" optional>
            <input
              type="email"
              value={value.email}
              onChange={(event) => onChange({ ...value, email: event.target.value })}
            />
          </FormField>
          <FormField label="Currency">
            <Dropdown
              name="vendor-currency"
              label="Vendor currency"
              searchable={false}
              value={value.defaultCurrency}
              onChange={(defaultCurrency) => onChange({ ...value, defaultCurrency })}
              options={PAYABLE_CURRENCY_OPTIONS}
            />
          </FormField>
          <FormField label="Payment terms">
            <Dropdown
              name="vendor-payment-terms"
              label="Payment terms"
              searchable={false}
              value={String(value.paymentTermsDays)}
              onChange={(days) => onChange({ ...value, paymentTermsDays: Number(days) })}
              options={[
                { value: "0", label: "Due immediately" },
                { value: "7", label: "Net 7" },
                { value: "15", label: "Net 15" },
                { value: "30", label: "Net 30" },
                { value: "60", label: "Net 60" },
              ]}
            />
          </FormField>
        </div>
      </FormModalSection>
    </FormModal>
  );
}
