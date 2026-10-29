import { DatePicker } from "@/components/ui/date-picker";
import { FormModal } from "@/components/ui/form-modal";
import type { WorkforceHolidayForm } from "../calendar-types";

export function WorkforceHolidayDialog({
  holiday,
  editing,
  onChange,
  onClose,
  onSubmit,
}: {
  holiday: WorkforceHolidayForm;
  editing: boolean;
  onChange: (holiday: WorkforceHolidayForm) => void;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
}) {
  return (
    <FormModal
      title={editing ? "Edit holiday" : "Add holiday"}
      badge="Calendar"
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel="Save holiday"
    >
      <div className="standard-form-grid">
        <label>
          Holiday name
          <input
            value={holiday.name}
            onChange={(event) => onChange({ ...holiday, name: event.target.value })}
          />
        </label>
        <label>
          {editing ? "Date" : "Starts on"}
          <DatePicker
            value={holiday.date}
            onChange={(date) => onChange({ ...holiday, date })}
            ariaLabel="Holiday date"
          />
        </label>
        {!editing && (
          <label>
            Ends on <small>Optional</small>
            <DatePicker
              value={holiday.endDate}
              min={holiday.date || undefined}
              onChange={(endDate) => onChange({ ...holiday, endDate })}
              ariaLabel="Holiday end date"
            />
            <small>Leave blank for one day. A range can include up to 31 days.</small>
          </label>
        )}
        <label>
          Partial-day duration <small>Optional</small>
          <input
            type="number"
            min="1"
            max="1440"
            value={holiday.durationMinutes ?? ""}
            onChange={(event) =>
              onChange({
                ...holiday,
                durationMinutes: event.target.value ? Number(event.target.value) : undefined,
              })
            }
            placeholder="Full day"
          />
        </label>
      </div>
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={holiday.isRecurring}
          onChange={(event) => onChange({ ...holiday, isRecurring: event.target.checked })}
        />
        <span>
          <strong>Repeat every year</strong>
          <small>Uses the same month and day each year.</small>
        </span>
      </label>
    </FormModal>
  );
}
