import { DatePicker } from "@/components/ui/date-picker";
import { Dropdown } from "@/components/ui/dropdown";
import { FormModal } from "@/components/ui/form-modal";
import type { EmployeeOption, LeaveType } from "../types";

export type LeavePolicy = {
  id: string;
  name: string;
  leaveTypeId: string;
  frequency: string;
  entitlementMinutes: number;
  carryForwardMode: string;
  carryForwardCapMinutes?: number;
  maximumBalanceMinutes?: number;
  expiresAfterMonths?: number;
  isActive: boolean;
};
export type LeavePolicyForm = {
  leaveTypeId: string;
  name: string;
  frequency: string;
  entitlementMinutes: number;
  effectiveFrom: string;
  prorateNewJoiners: boolean;
  carryForwardMode: string;
  carryForwardCapMinutes?: number;
  expiresAfterMonths?: number;
  isActive: boolean;
};
export type BalanceAdjustmentForm = {
  employeeId: string;
  leaveTypeId: string;
  hours: number;
  effectiveDate: string;
  reason: string;
};

export function LeavePolicyDialog({
  form,
  types,
  onChange,
  onClose,
  onSubmit,
}: {
  form: LeavePolicyForm;
  types: LeaveType[];
  onChange: (form: LeavePolicyForm) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <FormModal
      title="Create accrual policy"
      badge="Leave"
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel="Save policy"
    >
      <div className="standard-form-grid">
        <label>
          Leave type
          <Dropdown
            name="policyLeaveType"
            label="Leave type"
            value={form.leaveTypeId}
            onChange={(leaveTypeId) => onChange({ ...form, leaveTypeId })}
            options={types.map((type) => ({ value: type.id, label: type.name }))}
          />
        </label>
        <label>
          Policy name
          <input
            value={form.name}
            onChange={(event) => onChange({ ...form, name: event.target.value })}
            placeholder="Annual paid leave"
          />
        </label>
        <label>
          Accrual frequency
          <Dropdown
            name="policyFrequency"
            label="Accrual frequency"
            searchable={false}
            value={form.frequency}
            onChange={(frequency) => onChange({ ...form, frequency })}
            options={[
              { value: "ANNUAL", label: "Annual entitlement" },
              { value: "MONTHLY", label: "Monthly installments" },
              { value: "SERVICE_MONTHLY", label: "Per completed service month" },
            ]}
          />
        </label>
        <label>
          Annual entitlement (minutes)
          <input
            type="number"
            min="1"
            value={form.entitlementMinutes}
            onChange={(event) =>
              onChange({ ...form, entitlementMinutes: Number(event.target.value) })
            }
          />
        </label>
        <label>
          Effective from
          <DatePicker
            value={form.effectiveFrom}
            onChange={(effectiveFrom) => onChange({ ...form, effectiveFrom })}
            ariaLabel="Policy effective date"
          />
        </label>
        <label>
          Carry-forward
          <Dropdown
            name="carryForward"
            label="Carry-forward"
            searchable={false}
            value={form.carryForwardMode}
            onChange={(carryForwardMode) => onChange({ ...form, carryForwardMode })}
            options={[
              { value: "NONE", label: "Do not carry forward" },
              { value: "FULL", label: "Carry full balance" },
              { value: "CAPPED", label: "Carry up to a cap" },
            ]}
          />
        </label>
        {form.carryForwardMode === "CAPPED" && (
          <label>
            Carry-forward cap (minutes)
            <input
              type="number"
              min="0"
              value={form.carryForwardCapMinutes ?? ""}
              onChange={(event) =>
                onChange({ ...form, carryForwardCapMinutes: Number(event.target.value) })
              }
            />
          </label>
        )}
        <label>
          Expire carried leave after months <small>Optional</small>
          <input
            type="number"
            min="1"
            max="120"
            value={form.expiresAfterMonths ?? ""}
            onChange={(event) =>
              onChange({
                ...form,
                expiresAfterMonths: event.target.value ? Number(event.target.value) : undefined,
              })
            }
          />
        </label>
      </div>
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={form.prorateNewJoiners}
          onChange={(event) => onChange({ ...form, prorateNewJoiners: event.target.checked })}
        />
        <span>
          <strong>Prorate new joiners</strong>
          <small>Annual grants are reduced by the remaining months in the joining year.</small>
        </span>
      </label>
    </FormModal>
  );
}

export function BalanceAdjustmentDialog({
  form,
  employees,
  types,
  onChange,
  onClose,
  onSubmit,
}: {
  form: BalanceAdjustmentForm;
  employees: EmployeeOption[];
  types: LeaveType[];
  onChange: (form: BalanceAdjustmentForm) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <FormModal
      title="Adjust leave balance"
      badge="Ledger"
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel="Record adjustment"
    >
      <p className="muted">
        Add or subtract hours with an auditable ledger entry. Existing history is preserved.
      </p>
      <div className="standard-form-grid">
        <label>
          Employee
          <Dropdown
            name="adjustEmployee"
            label="Employee"
            value={form.employeeId}
            onChange={(employeeId) => onChange({ ...form, employeeId })}
            options={employees.map((employee) => ({
              value: employee.id,
              label: `${employee.firstName} ${employee.lastName}`,
            }))}
          />
        </label>
        <label>
          Leave type
          <Dropdown
            name="adjustLeaveType"
            label="Leave type"
            value={form.leaveTypeId}
            onChange={(leaveTypeId) => onChange({ ...form, leaveTypeId })}
            options={types.map((type) => ({ value: type.id, label: type.name }))}
          />
        </label>
        <label>
          Hours <small>Use a negative value to deduct</small>
          <input
            type="number"
            step="0.25"
            value={form.hours}
            onChange={(event) => onChange({ ...form, hours: Number(event.target.value) })}
          />
        </label>
        <label>
          Effective date
          <DatePicker
            value={form.effectiveDate}
            onChange={(effectiveDate) => onChange({ ...form, effectiveDate })}
            ariaLabel="Adjustment effective date"
          />
        </label>
      </div>
      <label>
        Reason
        <input
          value={form.reason}
          onChange={(event) => onChange({ ...form, reason: event.target.value })}
          placeholder="Explain why this balance changed"
        />
      </label>
    </FormModal>
  );
}
