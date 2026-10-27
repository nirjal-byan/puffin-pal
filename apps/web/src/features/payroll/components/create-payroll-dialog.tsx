import { DatePicker } from "@/components/ui/date-picker";
import { FormModal } from "@/components/ui/form-modal";
import type { PayrollEmployeeOption } from "../types";

export interface PayrollCreationForm {
  name: string;
  periodStart: string;
  periodEnd: string;
  paymentDate: string;
}

export function CreatePayrollDialog({
  form,
  employees,
  employeeIds,
  busy,
  onFormChange,
  onEmployeeIdsChange,
  onClose,
  onCreate,
}: {
  form: PayrollCreationForm;
  employees: PayrollEmployeeOption[];
  employeeIds: string[];
  busy: boolean;
  onFormChange: (form: PayrollCreationForm) => void;
  onEmployeeIdsChange: (employeeIds: string[]) => void;
  onClose: () => void;
  onCreate: () => void;
}) {
  return (
    <FormModal title="New pay run" onClose={onClose}>
      <div className="payroll-form">
        <label>
          Name
          <input
            value={form.name}
            onChange={(event) => onFormChange({ ...form, name: event.target.value })}
            placeholder="October payroll"
          />
        </label>
        <div className="payroll-date-grid">
          <label>
            Period start
            <DatePicker
              value={form.periodStart}
              onChange={(periodStart) => onFormChange({ ...form, periodStart })}
              ariaLabel="Payroll period start"
            />
          </label>
          <label>
            Period end
            <DatePicker
              value={form.periodEnd}
              onChange={(periodEnd) => onFormChange({ ...form, periodEnd })}
              min={form.periodStart || undefined}
              ariaLabel="Payroll period end"
            />
          </label>
        </div>
        <label>
          Payment date
          <DatePicker
            value={form.paymentDate}
            onChange={(paymentDate) => onFormChange({ ...form, paymentDate })}
            min={form.periodEnd || undefined}
            ariaLabel="Payroll payment date"
          />
        </label>
        <fieldset className="payroll-employees">
          <legend>Employees</legend>
          {employees.length === 0 ? (
            <p className="muted">No eligible employees found.</p>
          ) : (
            employees.map((employee) => (
              <label key={employee.id}>
                <input
                  type="checkbox"
                  checked={employeeIds.includes(employee.id)}
                  onChange={(event) =>
                    onEmployeeIdsChange(
                      event.target.checked
                        ? [...employeeIds, employee.id]
                        : employeeIds.filter((id) => id !== employee.id),
                    )
                  }
                />
                <span>
                  {employee.firstName} {employee.lastName}{" "}
                  <small className="muted">{employee.employeeCode}</small>
                </span>
              </label>
            ))
          )}
        </fieldset>
        <div className="form-actions">
          <button className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="button primary"
            disabled={busy || !form.name.trim() || employeeIds.length === 0}
            onClick={onCreate}
          >
            Create draft
          </button>
        </div>
      </div>
    </FormModal>
  );
}
