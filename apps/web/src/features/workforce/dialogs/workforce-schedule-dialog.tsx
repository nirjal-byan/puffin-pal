import { DatePicker } from "@/components/ui/date-picker";
import { Dropdown } from "@/components/ui/dropdown";
import { FormModal } from "@/components/ui/form-modal";
import type { EmployeeOption } from "../types";
import type { WorkforceScheduleForm } from "../calendar-types";

export function WorkforceScheduleDialog({
  schedule,
  employees,
  editing,
  onChange,
  onClose,
  onSubmit,
}: {
  schedule: WorkforceScheduleForm;
  employees: EmployeeOption[];
  editing: boolean;
  onChange: (schedule: WorkforceScheduleForm) => void;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
}) {
  return (
    <FormModal
      title={editing ? "Edit work schedule" : "Assign work schedule"}
      badge="Schedule"
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel="Save schedule"
    >
      <div className="standard-form-grid">
        <label>
          Schedule name
          <input
            value={schedule.name}
            onChange={(event) => onChange({ ...schedule, name: event.target.value })}
          />
        </label>
        <label>
          Employee
          <Dropdown
            name="scheduleEmployee"
            label="Employee"
            value={schedule.employeeId}
            onChange={(employeeId) => onChange({ ...schedule, employeeId })}
            options={employees.map((employee) => ({
              value: employee.id,
              label: `${employee.firstName} ${employee.lastName}`,
            }))}
          />
        </label>
        <label>
          Timezone
          <input
            value={schedule.timezone}
            onChange={(event) => onChange({ ...schedule, timezone: event.target.value })}
          />
        </label>
        <label>
          Workdays
          <Dropdown
            name="scheduleWorkdays"
            label="Workdays"
            searchable={false}
            value={schedule.workdays}
            onChange={(workdays) => onChange({ ...schedule, workdays })}
            options={[
              { value: "[1,2,3,4,5]", label: "Monday–Friday" },
              { value: "[1,2,3,4,5,6]", label: "Monday–Saturday" },
              { value: "[7,1,2,3,4]", label: "Sunday–Thursday" },
            ]}
          />
        </label>
        <label>
          Start time
          <input
            type="time"
            value={schedule.scheduledStartTime}
            onChange={(event) => onChange({ ...schedule, scheduledStartTime: event.target.value })}
          />
        </label>
        <label>
          End time
          <input
            type="time"
            value={schedule.scheduledEndTime}
            onChange={(event) => onChange({ ...schedule, scheduledEndTime: event.target.value })}
          />
        </label>
        <label>
          Expected work minutes
          <input
            type="number"
            min="1"
            max="1440"
            value={schedule.expectedDailyMinutes}
            onChange={(event) =>
              onChange({ ...schedule, expectedDailyMinutes: Number(event.target.value) })
            }
          />
        </label>
        <label>
          Unpaid break minutes
          <input
            type="number"
            min="0"
            max="1440"
            value={schedule.breakMinutes}
            onChange={(event) =>
              onChange({ ...schedule, breakMinutes: Number(event.target.value) })
            }
          />
        </label>
        <label>
          Effective from
          <DatePicker
            value={schedule.effectiveFrom}
            onChange={(effectiveFrom) => onChange({ ...schedule, effectiveFrom })}
            ariaLabel="Schedule effective date"
          />
        </label>
        <label>
          Effective to <small>Optional</small>
          <DatePicker
            value={schedule.effectiveTo}
            onChange={(effectiveTo) => onChange({ ...schedule, effectiveTo })}
            ariaLabel="Schedule end date"
          />
        </label>
      </div>
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={schedule.isActive}
          onChange={(event) => onChange({ ...schedule, isActive: event.target.checked })}
        />
        <span>
          <strong>Active schedule</strong>
          <small>Inactive schedules remain available in history.</small>
        </span>
      </label>
    </FormModal>
  );
}
