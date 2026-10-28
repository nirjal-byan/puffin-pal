import { DatePicker } from "@/components/ui/date-picker";
import { Dropdown } from "@/components/ui/dropdown";
import { FormField, FormModal, FormModalIntro, FormModalSection } from "@/components/ui/form-modal";
import type { PayrollSchedule, PayrollScheduleFormState } from "../types";

const FREQUENCY_OPTIONS = [
  { value: "WEEKLY", label: "Every week" },
  { value: "BIWEEKLY", label: "Every two weeks" },
  { value: "SEMIMONTHLY", label: "Twice a month" },
  { value: "MONTHLY", label: "Every month" },
];

const PAYMENT_TIMING_OPTIONS = [
  { value: "", label: "No intended date" },
  { value: "0", label: "On the period end date" },
  { value: "1", label: "1 day after period end" },
  { value: "3", label: "3 days after period end" },
  { value: "5", label: "5 days after period end" },
  { value: "7", label: "7 days after period end" },
];

const TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const hour = Math.floor(index / 2);
  const minute = index % 2 ? "30" : "00";
  const value = `${String(hour).padStart(2, "0")}:${minute}`;
  return {
    value,
    label: new Date(2000, 0, 1, hour, Number(minute)).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    }),
  };
});

export function PayrollScheduleDialog({
  schedule,
  form,
  busy,
  onChange,
  onClose,
  onSubmit,
}: {
  schedule: PayrollSchedule | null;
  form: PayrollScheduleFormState;
  busy: boolean;
  onChange: (form: PayrollScheduleFormState) => void;
  onClose: () => void;
  onSubmit: () => Promise<void>;
}) {
  const update = <Key extends keyof PayrollScheduleFormState>(
    key: Key,
    value: PayrollScheduleFormState[Key],
  ) => onChange({ ...form, [key]: value });

  return (
    <FormModal
      title={schedule ? "Edit payroll schedule" : "Set up payroll automation"}
      badge="Drafts only"
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel="Save schedule"
      submitting={busy}
      submitDisabled={!form.name.trim() || !form.timezone.trim()}
    >
      <FormModalIntro icon="↻" title="Prepare payroll automatically">
        Choose the payroll cadence, period start, and local draft creation time. Generated runs
        always remain drafts for review.
      </FormModalIntro>
      <FormModalSection title="Schedule details" description="Required payroll settings">
        <div className="standard-form-grid">
          <FormField label="Schedule name">
            <input value={form.name} onChange={(event) => update("name", event.target.value)} />
          </FormField>
          <FormField label="Frequency">
            <Dropdown
              name="payroll-frequency"
              label="Payroll frequency"
              searchable={false}
              value={form.frequency}
              onChange={(value) => update("frequency", value as PayrollSchedule["frequency"])}
              options={FREQUENCY_OPTIONS}
            />
          </FormField>
          <FormField label="First period starts">
            <DatePicker
              value={form.startDate}
              onChange={(value) => update("startDate", value)}
              ariaLabel="First payroll period start date"
            />
          </FormField>
          <FormField label="Timezone">
            <input
              value={form.timezone}
              onChange={(event) => update("timezone", event.target.value)}
              placeholder="America/Toronto"
            />
          </FormField>
          <FormField label="Create draft at">
            <Dropdown
              name="payroll-generation-time"
              label="Draft creation time"
              searchable={false}
              value={form.generationTime}
              onChange={(value) => update("generationTime", value)}
              options={TIME_OPTIONS}
            />
          </FormField>
          <FormField label="Intended payment timing" optional>
            <Dropdown
              name="payroll-payment-timing"
              label="Intended payment timing"
              searchable={false}
              value={form.paymentOffsetDays}
              onChange={(value) => update("paymentOffsetDays", value)}
              options={PAYMENT_TIMING_OPTIONS}
            />
          </FormField>
        </div>
        {form.frequency === "SEMIMONTHLY" && (
          <p className="field-hint">
            Semimonthly periods run from the 1st–15th and 16th–month end. Choose the 1st or 16th as
            the start date.
          </p>
        )}
      </FormModalSection>
    </FormModal>
  );
}
