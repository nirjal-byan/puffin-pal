import { DatePicker } from "@/components/ui/date-picker";
import { Dropdown } from "@/components/ui/dropdown";
import { FormField, FormModal, FormModalIntro, FormModalSection } from "@/components/ui/form-modal";
import type { VendorBill, VendorPaymentFormValue } from "../types";
export function VendorPaymentDialog({
  bill,
  value,
  onChange,
  onClose,
  onSubmit,
}: {
  bill: VendorBill | null;
  value: VendorPaymentFormValue;
  onChange: (value: VendorPaymentFormValue) => void;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
}) {
  return (
    <FormModal
      title="Record vendor payment"
      badge="Settlement"
      wide
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel="Record payment"
      submitDisabled={!value.amount || !value.paymentDate}
    >
      <FormModalIntro icon="$" title="Settle a vendor bill">
        Record money already paid and keep the bill balance accurate.
      </FormModalIntro>
      <FormModalSection
        title="Payment details"
        description={bill ? `Bill ${bill.billNumber}` : undefined}
      >
        <div className="standard-form-grid">
          <label className="form-field">
            <span>Amount</span>
            <input
              required
              inputMode="decimal"
              value={value.amount}
              onChange={(event) => onChange({ ...value, amount: event.target.value })}
            />
          </label>
          <FormField label="Payment date">
            <DatePicker
              ariaLabel="Vendor payment date"
              value={value.paymentDate}
              onChange={(paymentDate) => onChange({ ...value, paymentDate })}
            />
          </FormField>
          <FormField label="Method">
            <Dropdown
              name="vendor-payment-method"
              label="Payment method"
              searchable={false}
              value={value.method}
              onChange={(method) => onChange({ ...value, method })}
              options={[
                { value: "BANK_TRANSFER", label: "Bank transfer" },
                { value: "CARD", label: "Card" },
                { value: "CASH", label: "Cash" },
                { value: "CHEQUE", label: "Cheque" },
                { value: "OTHER", label: "Other" },
              ]}
            />
          </FormField>
          <FormField label="Reference" optional>
            <input
              value={value.reference}
              onChange={(event) => onChange({ ...value, reference: event.target.value })}
            />
          </FormField>
        </div>
      </FormModalSection>
    </FormModal>
  );
}
