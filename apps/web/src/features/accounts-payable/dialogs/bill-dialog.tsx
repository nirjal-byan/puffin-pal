import { VendorPicker } from "../components/vendor-picker";
import { DatePicker } from "@/components/ui/date-picker";
import { Dropdown } from "@/components/ui/dropdown";
import { FormField, FormModal, FormModalIntro, FormModalSection } from "@/components/ui/form-modal";
import { PAYABLE_CURRENCY_OPTIONS } from "../constants";
import { emptyBillItem } from "../services/payables-api";
import type { BillFormValue, Vendor } from "../types";

export function BillDialog({
  api,
  value,
  vendors,
  editing = false,
  busy = false,
  error = "",
  onChange,
  onClose,
  onSubmit,
}: {
  api: import("../types").AccountsPayableApi;
  value: BillFormValue;
  vendors: Vendor[];
  editing?: boolean;
  busy?: boolean;
  error?: string;
  onChange: (value: BillFormValue) => void;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
}) {
  return (
    <FormModal
      title={editing ? "Edit vendor bill" : "New vendor bill"}
      badge="Draft"
      wide
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel="Save draft"
      submitting={busy}
    >
      {error && (
        <p className="form-alert error" role="alert">
          {error}
        </p>
      )}
      {editing && (
        <p>
          Only draft bills can be edited. If someone changes this bill, close and reopen it to load
          the latest version.
        </p>
      )}
      <fieldset disabled={busy} style={{ border: 0, margin: 0, padding: 0 }}>
        <FormModalIntro icon="▧" title="Record a payable">
          Add the bill details and the amount your organization owes.
        </FormModalIntro>
        <FormModalSection title="Bill details" description="Supplier, dates, and currency">
          <div className="standard-form-grid">
            <div className="standard-form-grid-wide">
              <VendorPicker
                api={api}
                value={value.vendorId}
                selectedName={vendors.find((vendor) => vendor.id === value.vendorId)?.name}
                onChange={(vendorId, vendor) =>
                  onChange({
                    ...value,
                    vendorId,
                    currency: vendor?.defaultCurrency ?? value.currency,
                  })
                }
              />
            </div>
            <FormField label="Bill number">
              <input
                required
                maxLength={80}
                value={value.billNumber}
                onChange={(event) => onChange({ ...value, billNumber: event.target.value })}
              />
            </FormField>
            <FormField label="Vendor reference" optional>
              <input
                maxLength={100}
                value={value.vendorReference}
                onChange={(event) => onChange({ ...value, vendorReference: event.target.value })}
              />
            </FormField>
            <FormField label="Currency">
              <Dropdown
                name="bill-currency"
                label="Bill currency"
                searchable={false}
                value={value.currency}
                onChange={(currency) => onChange({ ...value, currency })}
                options={
                  PAYABLE_CURRENCY_OPTIONS.some(
                    ({ value: currency }) => currency === value.currency,
                  )
                    ? PAYABLE_CURRENCY_OPTIONS
                    : [
                        ...PAYABLE_CURRENCY_OPTIONS,
                        { value: value.currency, label: value.currency },
                      ]
                }
              />
            </FormField>
            <FormField label="Issue date">
              <DatePicker
                ariaLabel="Bill issue date"
                value={value.issueDate}
                onChange={(issueDate) => onChange({ ...value, issueDate })}
              />
            </FormField>
            <FormField label="Due date">
              <DatePicker
                ariaLabel="Bill due date"
                value={value.dueDate}
                min={value.issueDate}
                onChange={(dueDate) => onChange({ ...value, dueDate })}
              />
            </FormField>
            <FormField label="Description" optional wide>
              <textarea
                maxLength={2000}
                value={value.description}
                onChange={(event) => onChange({ ...value, description: event.target.value })}
              />
            </FormField>
            {value.expenseId && <p>This bill remains linked to its existing expense.</p>}
          </div>
        </FormModalSection>
        <FormModalSection
          title="Bill lines"
          description="Totals are calculated when the bill is saved."
        >
          {value.items.map((item, index) => (
            <section key={index} aria-label={`Line ${index + 1}`}>
              <h4>Line {index + 1}</h4>
              <div className="standard-form-grid">
                <FormField label="Line description" wide>
                  <input
                    required
                    maxLength={500}
                    value={item.description}
                    onChange={(event) =>
                      onChange({
                        ...value,
                        items: value.items.map((line, i) =>
                          i === index ? { ...line, description: event.target.value } : line,
                        ),
                      })
                    }
                  />
                </FormField>
                {(
                  [
                    ["quantity", "Quantity", "0.0001"],
                    ["unitPrice", "Unit price", "0.01"],
                    ["taxAmount", "Tax", "0.01"],
                    ["discountAmount", "Discount", "0.01"],
                  ] as const
                ).map(([key, label, step]) => (
                  <FormField key={key} label={label}>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step={step}
                      required
                      value={item[key]}
                      onChange={(event) =>
                        onChange({
                          ...value,
                          items: value.items.map((line, i) =>
                            i === index ? { ...line, [key]: event.target.value } : line,
                          ),
                        })
                      }
                    />
                  </FormField>
                ))}
              </div>
              <button
                type="button"
                className="button secondary compact"
                disabled={value.items.length === 1}
                onClick={() =>
                  onChange({ ...value, items: value.items.filter((_, i) => i !== index) })
                }
              >
                Remove line {index + 1}
              </button>
            </section>
          ))}
          <button
            type="button"
            className="button secondary"
            onClick={() => onChange({ ...value, items: [...value.items, emptyBillItem()] })}
          >
            Add line
          </button>
        </FormModalSection>
      </fieldset>
    </FormModal>
  );
}
