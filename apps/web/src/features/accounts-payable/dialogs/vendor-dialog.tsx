import { Dropdown } from "@/components/ui/dropdown";
import { FormField, FormModal, FormModalIntro, FormModalSection } from "@/components/ui/form-modal";
import { PAYABLE_CURRENCY_OPTIONS } from "../constants";
import type { VendorFormValue } from "../types";
export function VendorDialog({
  editing = false,
  busy = false,
  error = "",
  value,
  onChange,
  onClose,
  onSubmit,
}: {
  editing?: boolean;
  busy?: boolean;
  error?: string;
  value: VendorFormValue;
  onChange: (value: VendorFormValue) => void;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
}) {
  return (
    <FormModal
      title={editing ? "Edit vendor" : "Add vendor"}
      badge="Purchasing"
      wide
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel={editing ? "Save vendor" : "Add vendor"}
      submitting={busy}
      submitDisabled={!value.name.trim()}
    >
      {error && (
        <p className="form-alert error" role="alert">
          {error}
        </p>
      )}
      <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}>
        <FormModalIntro icon="◉" title="Supplier details">
          Keep purchasing contacts and payment defaults in one place.
        </FormModalIntro>
        <FormModalSection title="Vendor profile" description="Contact and payment defaults">
          <div className="standard-form-grid">
            <label className="form-field">
              <span>Vendor name</span>
              <input
                required
                maxLength={160}
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
                options={
                  PAYABLE_CURRENCY_OPTIONS.some(
                    ({ value: currency }) => currency === value.defaultCurrency,
                  )
                    ? PAYABLE_CURRENCY_OPTIONS
                    : [
                        ...PAYABLE_CURRENCY_OPTIONS,
                        { value: value.defaultCurrency, label: value.defaultCurrency },
                      ]
                }
              />
            </FormField>
            <FormField label="Payment terms (days)">
              <input
                type="number"
                required
                min={0}
                max={365}
                step={1}
                value={value.paymentTermsDays}
                onChange={(event) =>
                  onChange({ ...value, paymentTermsDays: event.target.valueAsNumber })
                }
              />
            </FormField>
            {(
              [
                ["displayName", "Display name", 160],
                ["phone", "Phone", 50],
                ["website", "Website", 300],
                ["address", "Address", 500],
                ["country", "Country", 80],
                ["taxId", "Tax ID", 80],
                ["notes", "Notes", 2000],
              ] as const
            ).map(([key, label, maxLength]) => (
              <FormField key={key} label={label} optional>
                <input
                  maxLength={maxLength}
                  value={value[key]}
                  onChange={(event) => onChange({ ...value, [key]: event.target.value })}
                />
              </FormField>
            ))}
          </div>
        </FormModalSection>
      </fieldset>
    </FormModal>
  );
}
