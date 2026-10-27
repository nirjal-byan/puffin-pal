import { FormModal } from "@/components/ui/form-modal";
import type { WorkforceSettings } from "../calendar-types";

export function WorkforceSettingsDialog({
  settings,
  onChange,
  onClose,
  onSubmit,
}: {
  settings: WorkforceSettings;
  onChange: (settings: WorkforceSettings) => void;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
}) {
  return (
    <FormModal
      title="Workforce settings"
      badge="Organization"
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel="Save settings"
    >
      <label>
        Organization timezone
        <input
          value={settings.timezone}
          onChange={(event) => onChange({ ...settings, timezone: event.target.value })}
        />
        <small>Schedules override this timezone for their assigned employees.</small>
      </label>
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={settings.unpaidLeaveDeductionsEnabled}
          onChange={(event) =>
            onChange({ ...settings, unpaidLeaveDeductionsEnabled: event.target.checked })
          }
        />
        <span>
          <strong>Enable unpaid-leave deduction proposals</strong>
          <small>Deductions still require explicit import into a payroll draft.</small>
        </span>
      </label>
    </FormModal>
  );
}
