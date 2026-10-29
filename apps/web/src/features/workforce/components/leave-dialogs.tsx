import { FormModal } from "@/components/ui/form-modal";
import { DatePicker } from "@/components/ui/date-picker";
import { Dropdown } from "@/components/ui/dropdown";
import type { EmployeeOption, LeaveType } from "../types";
export interface LeaveRequestForm {
  employeeId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  dayPortion: string;
  reason: string;
}
export interface LeaveTypeForm {
  name: string;
  code: string;
  isPaid: boolean;
  requiresApproval: boolean;
  annualAllowanceUnits: number;
}
export function LeaveRequestDialog({
  form,
  employees,
  types,
  onChange,
  onClose,
  onSubmit,
}: {
  form: LeaveRequestForm;
  employees: EmployeeOption[];
  types: LeaveType[];
  onChange: (form: LeaveRequestForm) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <FormModal title="Request leave" badge="Time off" onClose={onClose}>
      <div className="workforce-form">
        <div className="workforce-form-intro">
          <span className="workforce-form-icon" aria-hidden="true">
            ↗
          </span>
          <div>
            <strong>Plan time away</strong>
            <p>Select the policy and dates for this request.</p>
          </div>
        </div>
        <section className="workforce-form-section">
          <div className="workforce-form-section-heading">
            <span>Request details</span>
            <small>All fields except reason are required</small>
          </div>
          <div className="workforce-form-grid">
            <label>
              Employee
              <Dropdown
                name="leave-employee"
                label="Employee"
                placeholder="Select employee"
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
                name="leave-type"
                label="Leave type"
                placeholder="Select type"
                value={form.leaveTypeId}
                onChange={(leaveTypeId) => onChange({ ...form, leaveTypeId })}
                options={types
                  .filter((type) => type.isActive)
                  .map((type) => ({ value: type.id, label: type.name }))}
              />
            </label>
            <label>
              Start date
              <DatePicker
                value={form.startDate}
                onChange={(startDate) => onChange({ ...form, startDate })}
                ariaLabel="Leave start date"
              />
            </label>
            <label>
              End date
              <DatePicker
                value={form.endDate}
                onChange={(endDate) => onChange({ ...form, endDate })}
                min={form.startDate || undefined}
                ariaLabel="Leave end date"
              />
            </label>
            <label>
              Duration
              <Dropdown
                name="leave-duration"
                label="Leave duration"
                searchable={false}
                value={form.dayPortion}
                onChange={(dayPortion) => onChange({ ...form, dayPortion })}
                options={[
                  { value: "FULL_DAY", label: "Full days" },
                  { value: "HALF_DAY", label: "Half day" },
                ]}
              />
            </label>
          </div>
          <label>
            Reason <small>Optional</small>
            <textarea
              rows={3}
              placeholder="Add a short reason for the request"
              value={form.reason}
              onChange={(event) => onChange({ ...form, reason: event.target.value })}
            />
          </label>
        </section>
        <div className="workforce-form-actions">
          <button className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="button primary"
            disabled={!form.employeeId || !form.leaveTypeId || !form.startDate || !form.endDate}
            onClick={onSubmit}
          >
            Submit request
          </button>
        </div>
      </div>
    </FormModal>
  );
}
export function LeaveTypeDialog({
  form,
  onChange,
  onClose,
  onSubmit,
}: {
  form: LeaveTypeForm;
  onChange: (form: LeaveTypeForm) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <FormModal title="Create leave type" badge="Policy" onClose={onClose}>
      <div className="workforce-form">
        <div className="workforce-form-intro">
          <span className="workforce-form-icon" aria-hidden="true">
            ＋
          </span>
          <div>
            <strong>Create a time-off policy</strong>
            <p>Define how this leave appears and how much is available each year.</p>
          </div>
        </div>
        <section className="workforce-form-section">
          <div className="workforce-form-section-heading">
            <span>Policy details</span>
            <small>Reusable across your team</small>
          </div>
          <div className="workforce-form-grid">
            <label>
              Name
              <input
                placeholder="Annual leave"
                value={form.name}
                onChange={(event) => onChange({ ...form, name: event.target.value })}
              />
            </label>
            <label>
              Code
              <input
                placeholder="ANNUAL"
                value={form.code}
                onChange={(event) =>
                  onChange({ ...form, code: event.target.value.toUpperCase().replaceAll(" ", "_") })
                }
              />
            </label>
            <label>
              Annual allowance (half-day units)
              <input
                type="number"
                min="0"
                value={form.annualAllowanceUnits}
                onChange={(event) =>
                  onChange({ ...form, annualAllowanceUnits: Number(event.target.value) })
                }
              />
            </label>
          </div>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={form.isPaid}
              onChange={(event) => onChange({ ...form, isPaid: event.target.checked })}
            />{" "}
            Paid leave
          </label>
        </section>
        <div className="workforce-form-actions">
          <button className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={!form.name || !form.code} onClick={onSubmit}>
            Create type
          </button>
        </div>
      </div>
    </FormModal>
  );
}
