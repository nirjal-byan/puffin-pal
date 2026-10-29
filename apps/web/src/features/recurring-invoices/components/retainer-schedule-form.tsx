import type { Permission } from "@puffinpal/permissions";
import type { Client } from "@/lib/api";
import { DatePicker } from "@/components/ui/date-picker";
import { Dropdown } from "@/components/ui/dropdown";
import { FormModal } from "@/components/ui/form-modal";
import { BILLING_FREQUENCIES, PAYMENT_TERMS } from "../constants";
import type { RecurringFormValues, RecurringOccurrence } from "../types";
import { recurringFrequencyLabel } from "../utils";
import { RetainerHistory } from "./retainer-history";

export function RetainerScheduleForm({
  isNew,
  form,
  clients,
  currency,
  permissions,
  occurrences,
  saving,
  onChange,
  onClose,
  onSubmit,
  onRetry,
}: {
  isNew: boolean;
  form: RecurringFormValues;
  clients: Client[];
  currency: string;
  permissions: readonly Permission[];
  occurrences: RecurringOccurrence[];
  saving: boolean;
  onChange: (form: RecurringFormValues) => void;
  onClose: () => void;
  onSubmit: () => void;
  onRetry: (occurrence: RecurringOccurrence) => void;
}) {
  const update = <K extends keyof RecurringFormValues>(key: K, value: RecurringFormValues[K]) =>
    onChange({ ...form, [key]: value });
  const updateItem = (index: number, values: Partial<RecurringFormValues["items"][number]>) =>
    update(
      "items",
      form.items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...values } : item)),
    );
  const frequencyValue = `${form.frequency}:${form.interval}`;
  const frequencyOptions = BILLING_FREQUENCIES.some((option) => option.value === frequencyValue)
    ? [...BILLING_FREQUENCIES]
    : [
        { value: frequencyValue, label: recurringFrequencyLabel(form.frequency, form.interval) },
        ...BILLING_FREQUENCIES,
      ];
  const paymentOptions = (
    PAYMENT_TERMS.some((option) => option.value === form.dueDateOffsetDays)
      ? PAYMENT_TERMS
      : [
          {
            value: form.dueDateOffsetDays,
            label: `Due ${form.dueDateOffsetDays} days after issue`,
          },
          ...PAYMENT_TERMS,
        ]
  ).map((option) => ({ ...option, value: String(option.value) }));
  return (
    <FormModal
      title={isNew ? "Create recurring invoice" : "Edit recurring invoice"}
      badge="Schedule"
      wide
      onClose={onClose}
    >
      <form
        className="recurring-form workforce-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <section className="workforce-form-section">
          <div className="workforce-form-section-heading">
            <span>Schedule details</span>
            <small>Client and billing cadence</small>
          </div>
          <div className="workforce-form-grid workforce-form-grid-3">
            <label>
              Schedule name
              <input
                required
                maxLength={120}
                placeholder="Monthly support retainer"
                value={form.name}
                onChange={(event) => update("name", event.target.value)}
              />
              <small>Required</small>
            </label>
            <label>
              Client
              <Dropdown
                name="recurring-client"
                label="Client"
                placeholder="Select client"
                value={form.clientId}
                onChange={(value) => update("clientId", value)}
                options={clients.map((client) => ({ value: client.id, label: client.name }))}
              />
              <small>Required</small>
            </label>
            <label>
              Billing frequency
              <Dropdown
                name="recurring-frequency"
                label="Billing frequency"
                searchable={false}
                value={frequencyValue}
                onChange={(value) => {
                  const [frequency = "MONTHLY", interval = "1"] = value.split(":");
                  onChange({ ...form, frequency, interval: Number(interval) });
                }}
                options={frequencyOptions}
              />
            </label>
            <label>
              Start date
              <DatePicker
                value={form.startDate}
                onChange={(value) => update("startDate", value)}
                ariaLabel="Recurring invoice start date"
              />
            </label>
            <label>
              End date
              <DatePicker
                value={form.endDate}
                onChange={(value) => update("endDate", value)}
                min={form.startDate || undefined}
                ariaLabel="Recurring invoice end date"
              />
              <small>Optional</small>
            </label>
            <label>
              Payment terms
              <Dropdown
                name="recurring-payment-terms"
                label="Payment terms"
                searchable={false}
                value={String(form.dueDateOffsetDays)}
                onChange={(value) => update("dueDateOffsetDays", Number(value))}
                options={paymentOptions}
              />
            </label>
          </div>
          <label>
            Description
            <textarea
              rows={2}
              placeholder="Optional note included with this recurring schedule"
              value={form.description}
              onChange={(event) => update("description", event.target.value)}
            />
            <small>Optional</small>
          </label>
        </section>
        <fieldset className="recurring-items">
          <legend>Invoice line items</legend>
          <div className="recurring-item-head" aria-hidden="true">
            <span>Description</span>
            <span>Quantity</span>
            <span>Unit price ({currency})</span>
            <span />
          </div>
          {form.items.map((item, index) => (
            <div className="recurring-item" key={index}>
              <input
                aria-label={`Item ${index + 1} description`}
                required
                placeholder="Service or product"
                value={item.description}
                onChange={(event) => updateItem(index, { description: event.target.value })}
              />
              <input
                aria-label={`Item ${index + 1} quantity`}
                type="number"
                min="1"
                value={item.quantity}
                onChange={(event) => updateItem(index, { quantity: Number(event.target.value) })}
              />
              <input
                aria-label={`Item ${index + 1} unit price`}
                inputMode="decimal"
                value={item.unitPrice}
                onChange={(event) => updateItem(index, { unitPrice: event.target.value })}
              />
              {form.items.length > 1 && (
                <button
                  type="button"
                  className="text-button danger-text"
                  onClick={() =>
                    update(
                      "items",
                      form.items.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className="button secondary compact"
            onClick={() =>
              update("items", [...form.items, { description: "", quantity: 1, unitPrice: "0.00" }])
            }
          >
            + Add item
          </button>
        </fieldset>
        <label className="checkbox-label recurring-auto-issue">
          <input
            type="checkbox"
            checked={form.autoIssue}
            disabled={!permissions.includes("invoices:issue")}
            onChange={(event) => update("autoIssue", event.target.checked)}
          />
          <span className="recurring-auto-copy">
            <strong>Issue invoices automatically</strong>
            <small>Finalize and store each invoice automatically on its scheduled date.</small>
          </span>
        </label>
        {!isNew && <RetainerHistory occurrences={occurrences} onRetry={onRetry} />}
        <div className="workforce-form-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={saving}>
            {saving ? "Saving…" : "Save schedule"}
          </button>
        </div>
      </form>
    </FormModal>
  );
}
