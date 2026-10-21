import { useState } from "react";
import type { ReactNode } from "react";
import { AppModal } from "../../../components/app-modal";
import { DatePicker } from "../../../components/date-picker";
import { Dropdown } from "../../../components/dropdown";
import { FormModal } from "../../../components/form-modal";
import type { Department, Employee, SalaryFormValues, SalaryStructure } from "./types";

export function DepartmentModal({
  departments,
  isSaving,
  onSave,
  onDelete,
  onClose,
}: {
  departments: Department[];
  isSaving: boolean;
  onSave: (name: string, department?: Department) => void;
  onDelete: (department: Department) => void;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState<Department | null>(null);
  const [name, setName] = useState("");

  function startEdit(department?: Department) {
    setEditing(department ?? null);
    setName(department?.name ?? "");
  }

  return (
    <AppModal title="Departments" badge="Organization" onClose={onClose}>
      <form
        className="department-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(name, editing ?? undefined);
        }}
      >
        <label>
          {editing ? "Rename department" : "New department"}
          <input
            required
            maxLength={100}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <div className="row-actions">
          <button className="button primary compact" disabled={isSaving}>
            {editing ? "Save name" : "Add department"}
          </button>
          {editing && (
            <button type="button" className="button secondary compact" onClick={() => startEdit()}>
              Cancel
            </button>
          )}
        </div>
      </form>
      <div className="department-list">
        {departments.map((department) => (
          <div key={department.id}>
            <strong>{department.name}</strong>
            <div className="row-actions">
              <button className="text-button" onClick={() => startEdit(department)}>
                Rename
              </button>
              <button className="text-button danger-text" onClick={() => onDelete(department)}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </AppModal>
  );
}

export function ConfirmationModal({
  title,
  message,
  confirmLabel,
  danger = false,
  isSaving,
  onConfirm,
  onClose,
  children,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  isSaving: boolean;
  onConfirm: () => void;
  onClose: () => void;
  children?: ReactNode;
}) {
  return (
    <AppModal title={title} onClose={onClose}>
      <div className="confirmation-content">
        <p>{message}</p>
        {children}
        <div className="modal-form-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={`button ${danger ? "danger" : "primary"}`}
            disabled={isSaving}
            onClick={onConfirm}
          >
            {isSaving ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </AppModal>
  );
}

export function EmployeeDetailsModal({
  employee,
  salaryStructures,
  currency,
  canManage,
  canReadSalary,
  canManageSalary,
  onTerminate,
  onAddSalary,
  onClose,
}: {
  employee: Employee;
  salaryStructures: SalaryStructure[];
  currency: string;
  canManage: boolean;
  canReadSalary: boolean;
  canManageSalary: boolean;
  onTerminate: () => void;
  onAddSalary: () => void;
  onClose: () => void;
}) {
  const money = (salary: SalaryStructure) =>
    new Intl.NumberFormat("en", {
      style: "currency",
      currency: salary.currency || currency,
    }).format(Number(salary.baseAmount));
  return (
    <AppModal
      title={`${employee.firstName} ${employee.lastName}`}
      badge={employee.status.replaceAll("_", " ")}
      onClose={onClose}
    >
      <div className="employee-profile">
        <dl>
          <div>
            <dt>Employee code</dt>
            <dd>{employee.employeeCode}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>{employee.jobTitle}</dd>
          </div>
          <div>
            <dt>Department</dt>
            <dd>{employee.department?.name ?? "—"}</dd>
          </div>
          <div>
            <dt>Hire date</dt>
            <dd>{new Date(employee.hireDate).toLocaleDateString()}</dd>
          </div>
        </dl>
        {canManage && employee.status !== "TERMINATED" && (
          <button className="button danger" onClick={onTerminate}>
            Terminate employment
          </button>
        )}
        {canReadSalary && (
          <section className="salary-history">
            <div className="panel-heading">
              <h3>Salary history</h3>
              {canManageSalary && (
                <button className="button secondary compact" onClick={onAddSalary}>
                  + Salary
                </button>
              )}
            </div>
            {salaryStructures.length === 0 ? (
              <p className="muted">No salary structures recorded.</p>
            ) : (
              salaryStructures.map((salary) => (
                <article key={salary.id}>
                  <strong>{money(salary)}</strong>
                  <span>
                    {salary.compensationType.replaceAll("_", " ")} ·{" "}
                    {salary.payFrequency.toLowerCase()}
                  </span>
                  <small>
                    {new Date(salary.effectiveFrom).toLocaleDateString()} –{" "}
                    {salary.effectiveTo
                      ? new Date(salary.effectiveTo).toLocaleDateString()
                      : "Current"}
                  </small>
                  {salary.components.length > 0 && (
                    <small>
                      {salary.components
                        .map((component) => `${component.name}: ${component.amount}`)
                        .join(" · ")}
                    </small>
                  )}
                </article>
              ))
            )}
          </section>
        )}
      </div>
    </AppModal>
  );
}

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
                onChange={(event) =>
                  onChange({
                    ...values,
                    components: values.components.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, name: event.target.value } : item,
                    ),
                  })
                }
              />
              <Dropdown
                name={`salary-component-${index}-type`}
                label={`Component ${index + 1} type`}
                searchable={false}
                value={component.type}
                onChange={(type) =>
                  onChange({
                    ...values,
                    components: values.components.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, type: type as "EARNING" | "DEDUCTION" }
                        : item,
                    ),
                  })
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
                onChange={(event) =>
                  onChange({
                    ...values,
                    components: values.components.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, amount: event.target.value } : item,
                    ),
                  })
                }
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
                components: [...values.components, { name: "", type: "EARNING", amount: "" }],
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
