import { DatePicker } from "@/components/ui/date-picker";
import { Dropdown } from "@/components/ui/dropdown";
import { FormField, FormModal, FormModalIntro, FormModalSection } from "@/components/ui/form-modal";
import { PAYABLE_CURRENCY_OPTIONS } from "./constants";
import type { BillFormValue, Vendor } from "./types";
export function BillDialog({
  value,
  vendors,
  onChange,
  onClose,
  onSubmit,
}: {
  value: BillFormValue;
  vendors: Vendor[];
  onChange: (value: BillFormValue) => void;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
}) {
  return (
    <FormModal
      title="New vendor bill"
      badge="Draft"
      wide
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel="Save draft"
      submitDisabled={
        !value.vendorId ||
        !value.billNumber.trim() ||
        !value.issueDate ||
        !value.dueDate ||
        !value.itemDescription.trim()
      }
    >
      <FormModalIntro icon="▧" title="Record a payable">
        Add the bill details and the amount your organization owes.
      </FormModalIntro>
      <FormModalSection title="Bill details" description="Supplier, dates, and currency">
        <div className="standard-form-grid">
          <FormField label="Vendor" wide>
            <Dropdown
              name="bill-vendor"
              label="Vendor"
              value={value.vendorId}
              onChange={(vendorId) => {
                const vendor = vendors.find((item) => item.id === vendorId);
                onChange({
                  ...value,
                  vendorId,
                  currency: vendor?.defaultCurrency ?? value.currency,
                });
              }}
              options={vendors
                .filter((vendor) => vendor.active)
                .map((vendor) => ({ value: vendor.id, label: vendor.displayName || vendor.name }))}
            />
          </FormField>
          <label className="form-field">
            <span>Bill number</span>
            <input
              required
              value={value.billNumber}
              onChange={(event) => onChange({ ...value, billNumber: event.target.value })}
            />
          </label>
          <FormField label="Currency">
            <Dropdown
              name="bill-currency"
              label="Bill currency"
              searchable={false}
              value={value.currency}
              onChange={(currency) => onChange({ ...value, currency })}
              options={PAYABLE_CURRENCY_OPTIONS}
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
          <label className="form-field standard-form-grid-wide">
            <span>Line description</span>
            <input
              required
              value={value.itemDescription}
              onChange={(event) => onChange({ ...value, itemDescription: event.target.value })}
            />
          </label>
          <label className="form-field">
            <span>Quantity</span>
            <input
              inputMode="decimal"
              required
              value={value.quantity}
              onChange={(event) => onChange({ ...value, quantity: event.target.value })}
            />
          </label>
          <label className="form-field">
            <span>Unit price</span>
            <input
              inputMode="decimal"
              required
              value={value.unitPrice}
              onChange={(event) => onChange({ ...value, unitPrice: event.target.value })}
            />
          </label>
        </div>
      </FormModalSection>
    </FormModal>
  );
}
