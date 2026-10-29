import { DatePicker } from "@/components/ui/date-picker";
import { Dropdown } from "@/components/ui/dropdown";
import { FormModal } from "@/components/ui/form-modal";
import type { SalaryComponent, SalaryFormValues } from "../types/employee.types";

export function SalaryFormModal({
  values,
  currency,
  isSaving,
  onChange,
  onSubmit,
  onClose,
}: {
  values: SalaryFormValues;
  currency: string;
  isSaving: boolean;
  onChange: (values: SalaryFormValues) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const updateComponent = (index: number, change: Partial<SalaryComponent>) =>
    onChange({
      ...values,
      components: values.components.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...change } : item,
      ),
    });
  return (
    <FormModal title="Add salary structure" badge="Confidential" onClose={onClose}>
      <form
        className="employee-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div className="form-grid">
          <label>
            Compensation
            <Dropdown
              name="salary-compensation-type"
              label="Compensation type"
              searchable={false}
              value={values.compensationType}
              onChange={(compensationType) =>
                onChange({
                  ...values,
                  compensationType: compensationType as SalaryFormValues["compensationType"],
                })
              }
              options={[
                { value: "FIXED_SALARY", label: "Fixed salary" },
                { value: "HOURLY", label: "Hourly" },
              ]}
            />
          </label>
          <label>
            Base amount ({currency})
            <input
              required
              inputMode="decimal"
              value={values.baseAmount}
              onChange={(event) => onChange({ ...values, baseAmount: event.target.value })}
            />
          </label>
          <label>
            Pay frequency
            <Dropdown
              name="salary-pay-frequency"
              label="Pay frequency"
              searchable={false}
              value={values.payFrequency}
              onChange={(payFrequency) =>
                onChange({
                  ...values,
                  payFrequency: payFrequency as SalaryFormValues["payFrequency"],
                })
              }
              options={[
                { value: "MONTHLY", label: "Monthly" },
                { value: "BIWEEKLY", label: "Biweekly" },
                { value: "WEEKLY", label: "Weekly" },
              ]}
            />
          </label>
          <label>
            Effective from
            <DatePicker
              value={values.effectiveFrom}
              onChange={(effectiveFrom) => onChange({ ...values, effectiveFrom })}
              ariaLabel="Salary effective from date"
            />
          </label>
          <label>
            Effective to <small>optional</small>
            <DatePicker
              value={values.effectiveTo}
              onChange={(effectiveTo) => onChange({ ...values, effectiveTo })}
              min={values.effectiveFrom || undefined}
              ariaLabel="Salary effective to date"
            />
          </label>
        </div>
        <label>
          Notes <small>optional</small>
          <textarea
            rows={2}
            value={values.notes}
            onChange={(event) => onChange({ ...values, notes: event.target.value })}
          />
        </label>
        <fieldset>
          <legend>Allowances and deductions</legend>
          {values.components.map((component, index) => (
            <div className="salary-component" key={index}>
              <input
                required
                placeholder="Component name"
                value={component.name}
                onChange={(event) => updateComponent(index, { name: event.target.value })}
              />
              <Dropdown
                name={`salary-component-${index}-statutory`}
                label={`Component ${index + 1} tax treatment`}
                searchable={false}
                value={component.statutoryClass}
                onChange={(statutoryClass) =>
                  updateComponent(index, {
                    statutoryClass: statutoryClass as SalaryComponent["statutoryClass"],
                  })
                }
                options={
                  component.type === "EARNING"
                    ? [
                        { value: "TAXABLE_EARNING", label: "Taxable earning" },
                        { value: "NON_TAXABLE_EARNING", label: "Non-taxable earning" },
                      ]
                    : [
                        { value: "PRE_TAX_DEDUCTION", label: "Pre-tax deduction" },
                        { value: "POST_TAX_DEDUCTION", label: "Post-tax deduction" },
                      ]
                }
              />
              <Dropdown
                name={`salary-component-${index}-type`}
                label={`Component ${index + 1} type`}
                searchable={false}
                value={component.type}
                onChange={(type) =>
                  updateComponent(index, { type: type as "EARNING" | "DEDUCTION" })
                }
                options={[
                  { value: "EARNING", label: "Earning" },
                  { value: "DEDUCTION", label: "Deduction" },
                ]}
              />
              <input
                required
                inputMode="decimal"
                placeholder="0.00"
                value={component.amount}
                onChange={(event) => updateComponent(index, { amount: event.target.value })}
              />
              <button
                type="button"
                className="text-button"
                onClick={() =>
                  onChange({
                    ...values,
                    components: values.components.filter((_, itemIndex) => itemIndex !== index),
                  })
                }
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            className="button secondary compact"
            onClick={() =>
              onChange({
                ...values,
                components: [
                  ...values.components,
                  { name: "", type: "EARNING", amount: "", statutoryClass: "TAXABLE_EARNING" },
                ],
              })
            }
          >
            + Component
          </button>
        </fieldset>
        <div className="modal-form-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={isSaving}>
            {isSaving ? "Saving…" : "Add salary"}
          </button>
        </div>
      </form>
    </FormModal>
  );
}
