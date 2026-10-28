import { CurrencyDropdown } from "@/components/ui/currency-dropdown";
import { DatePicker } from "@/components/ui/date-picker";
import { Dropdown } from "@/components/ui/dropdown";
import {
  FormCheckbox,
  FormField,
  FormModal,
  FormModalIntro,
  FormModalSection,
} from "@/components/ui/form-modal";
import type { StatutoryFormState } from "../types";

export function StatutoryConfigurationDialog({
  form,
  onChange,
  onClose,
  onSubmit,
}: {
  form: StatutoryFormState;
  onChange: (form: StatutoryFormState) => void;
  onClose: () => void;
  onSubmit: () => Promise<void>;
}) {
  const update = <Key extends keyof StatutoryFormState>(key: Key, value: StatutoryFormState[Key]) =>
    onChange({ ...form, [key]: value });

  return (
    <FormModal
      title="Configure statutory rules"
      badge="Payroll"
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel="Save and activate"
    >
      <FormModalIntro icon="%" title="Set statutory calculation rules">
        Configure verified rates and effective dates. A decimal rate of 0.10 means 10%. This setup
        is not legal or tax advice.
      </FormModalIntro>
      <FormModalSection title="Jurisdiction" description="Tax authority and reporting currency">
        <div className="standard-form-grid">
          <FormField label="Country code">
            <input
              maxLength={2}
              value={form.countryCode}
              onChange={(event) => update("countryCode", event.target.value)}
              placeholder="US"
            />
          </FormField>
          <FormField label="Region" optional>
            <input
              value={form.subdivisionCode}
              onChange={(event) => update("subdivisionCode", event.target.value)}
            />
          </FormField>
          <FormField label="Currency">
            <CurrencyDropdown
              value={form.currency}
              onChange={(currency) => update("currency", currency)}
              name="statutory-currency"
              label="Statutory reporting currency"
            />
          </FormField>
        </div>
      </FormModalSection>
      <FormModalSection title="Effective rule version" description="Calculation method and dates">
        <div className="standard-form-grid">
          <FormField label="Rule-set name">
            <input value={form.name} onChange={(event) => update("name", event.target.value)} />
          </FormField>
          <FormField label="Effective from">
            <DatePicker
              value={form.effectiveFrom}
              onChange={(value) => update("effectiveFrom", value)}
              ariaLabel="Statutory rule effective date"
            />
          </FormField>
          <FormField label="Pay periods per year">
            <Dropdown
              name="statutory-periods"
              label="Pay periods per year"
              searchable={false}
              value={String(form.periodsPerYear)}
              onChange={(value) => update("periodsPerYear", Number(value))}
              options={[12, 24, 26, 52].map((value) => ({
                value: String(value),
                label: `${value} periods`,
              }))}
            />
          </FormField>
          <FormField label="Income-tax method">
            <Dropdown
              name="statutory-tax-method"
              label="Income-tax method"
              searchable={false}
              value={form.taxMethod}
              onChange={(value) => update("taxMethod", value as StatutoryFormState["taxMethod"])}
              options={[
                { value: "FLAT", label: "Flat withholding rate" },
                { value: "PROGRESSIVE", label: "Two progressive brackets" },
              ]}
            />
          </FormField>
          {form.taxMethod === "FLAT" ? (
            <RateField
              label="Flat withholding rate"
              value={form.flatRate}
              onChange={(value) => update("flatRate", value)}
            />
          ) : (
            <>
              <RateField
                label="First bracket ends at"
                value={form.bracketThreshold}
                onChange={(value) => update("bracketThreshold", value)}
              />
              <RateField
                label="First bracket rate"
                value={form.lowerBracketRate}
                onChange={(value) => update("lowerBracketRate", value)}
              />
              <RateField
                label="Remaining income rate"
                value={form.upperBracketRate}
                onChange={(value) => update("upperBracketRate", value)}
              />
            </>
          )}
          <RateField
            label="Employee contribution rate"
            value={form.employeeRate}
            onChange={(value) => update("employeeRate", value)}
          />
          <RateField
            label="Employer contribution rate"
            value={form.employerRate}
            onChange={(value) => update("employerRate", value)}
          />
        </div>
      </FormModalSection>
      <FormCheckbox
        checked={form.mandatoryCalculation}
        onChange={(value) => update("mandatoryCalculation", value)}
        label="Require statutory calculations before approval"
        description="Blocks submission until every payroll entry has an applied snapshot."
      />
    </FormModal>
  );
}

function RateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <FormField label={label}>
      <input inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} />
    </FormField>
  );
}
