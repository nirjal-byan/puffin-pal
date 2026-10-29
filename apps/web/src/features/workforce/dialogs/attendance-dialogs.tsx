import { DatePicker } from "@/components/ui/date-picker";
import { Dropdown } from "@/components/ui/dropdown";
import { FormModal } from "@/components/ui/form-modal";
import type { AttendanceRecord, EmployeeOption } from "../types";
import { shortDate } from "../types";

export interface AttendanceForm {
  employeeId: string;
  workDate: string;
  status: string;
  notes: string;
}
export interface CorrectionForm {
  proposedStatus: string;
  proposedWorkedMinutes: number;
  reason: string;
}
const statuses = ["PRESENT", "ABSENT", "HALF_DAY", "ON_LEAVE", "HOLIDAY"].map((value) => ({
  value,
  label: value.replaceAll("_", " "),
}));

export function RecordAttendanceDialog({
  form,
  employees,
  onChange,
  onClose,
  onSave,
}: {
  form: AttendanceForm;
  employees: EmployeeOption[];
  onChange: (form: AttendanceForm) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <FormModal title="Record attendance" badge="Attendance" onClose={onClose}>
      <div className="workforce-form">
        <div className="workforce-form-intro">
          <span className="workforce-form-icon" aria-hidden="true">
            ✓
          </span>
          <div>
            <strong>Add a daily record</strong>
            <p>Choose an employee, date, and attendance status.</p>
          </div>
        </div>
        <section className="workforce-form-section">
          <div className="workforce-form-section-heading">
            <span>Record details</span>
            <small>Required fields</small>
          </div>
          <div className="workforce-form-grid">
            <label>
              Employee
              <Dropdown
                name="attendance-employee"
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
              Work date
              <DatePicker
                value={form.workDate}
                onChange={(workDate) => onChange({ ...form, workDate })}
                ariaLabel="Work date"
              />
            </label>
            <label>
              Status
              <Dropdown
                name="attendance-status"
                label="Attendance status"
                searchable={false}
                value={form.status}
                onChange={(status) => onChange({ ...form, status })}
                options={statuses}
              />
            </label>
          </div>
          <label>
            Notes <small>Optional context for this record</small>
            <textarea
              rows={3}
              placeholder="Add context about this attendance record"
              value={form.notes}
              onChange={(event) => onChange({ ...form, notes: event.target.value })}
            />
          </label>
        </section>
        <div className="workforce-form-actions">
          <button className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={!form.employeeId} onClick={onSave}>
            Save attendance
          </button>
        </div>
      </div>
    </FormModal>
  );
}

export function AttendanceCorrectionDialog({
  record,
  form,
  onChange,
  onClose,
  onSubmit,
}: {
  record: AttendanceRecord;
  form: CorrectionForm;
  onChange: (form: CorrectionForm) => void;
  onClose: () => void;
  onSubmit: () => Promise<void>;
}) {
  return (
    <FormModal
      title="Request attendance correction"
      badge={shortDate(record.workDate)}
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel="Submit request"
    >
      <div className="standard-form-grid">
        <label>
          Correct status
          <Dropdown
            name="correctionStatus"
            label="Correct status"
            searchable={false}
            value={form.proposedStatus}
            onChange={(proposedStatus) => onChange({ ...form, proposedStatus })}
            options={statuses}
          />
        </label>
        <label>
          Worked minutes
          <input
            type="number"
            min="0"
            max="1440"
            value={form.proposedWorkedMinutes}
            onChange={(event) =>
              onChange({ ...form, proposedWorkedMinutes: Number(event.target.value) })
            }
          />
        </label>
      </div>
      <label>
        Why is this correction needed?
        <textarea
          rows={4}
          value={form.reason}
          onChange={(event) => onChange({ ...form, reason: event.target.value })}
        />
      </label>
    </FormModal>
  );
}
