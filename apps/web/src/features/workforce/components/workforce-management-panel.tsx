import type { WorkforceCalendarData } from "../calendar-types";
import { workforceIsoDate } from "../calendar-utils";

export function WorkforceManagementPanel({
  data,
  onAddSchedule,
  onAddHoliday,
  onEditSchedule,
  onEditHoliday,
  onDeleteHoliday,
}: {
  data: WorkforceCalendarData;
  onAddSchedule: () => void;
  onAddHoliday: () => void;
  onEditSchedule: (row: WorkforceCalendarData["schedules"][number]) => void;
  onEditHoliday: (row: WorkforceCalendarData["holidays"][number]) => void;
  onDeleteHoliday: (id: string) => void;
}) {
  const today = workforceIsoDate(new Date());
  return (
    <aside className="panel workforce-management-panel">
      <div className="workforce-management-group">
        <div className="workforce-management-heading">
          <div>
            <span className="eyebrow">Schedules</span>
            <h3>Work patterns</h3>
          </div>
          <button className="button secondary compact" onClick={onAddSchedule}>
            + Assign
          </button>
        </div>
        <div className="workforce-management-list">
          {data.schedules.length ? (
            data.schedules.map((row) => (
              <button type="button" key={row.id} onClick={() => onEditSchedule(row)}>
                <span>
                  <strong>{row.name}</strong>
                  <small>{row.effectiveFrom.slice(0, 10)}</small>
                </span>
                <span className={`workforce-status ${row.isActive ? "active" : ""}`}>
                  {row.isActive ? "Active" : "Inactive"}
                </span>
              </button>
            ))
          ) : (
            <p className="workforce-management-empty">No schedules assigned.</p>
          )}
        </div>
      </div>
      <div className="workforce-management-group">
        <div className="workforce-management-heading">
          <div>
            <span className="eyebrow">Holidays</span>
            <h3>Time off calendar</h3>
          </div>
          <button className="button primary compact" onClick={onAddHoliday}>
            + Add
          </button>
        </div>
        <div className="workforce-management-list">
          {data.holidays.length ? (
            data.holidays.map((row) => {
              const historical = row.date.slice(0, 10) < today;
              return (
                <div className="workforce-management-item" key={row.id}>
                  <button
                    type="button"
                    disabled={historical}
                    title={historical ? "Historical holidays are locked" : "Edit holiday"}
                    onClick={() => onEditHoliday(row)}
                  >
                    <span>
                      <strong>{row.name}</strong>
                      <small>{row.date.slice(0, 10)}</small>
                    </span>
                    <span className="workforce-status">
                      {historical ? "Historical" : row.isRecurring ? "Annual" : "Once"}
                    </span>
                  </button>
                  {!historical && (
                    <button
                      className="workforce-delete"
                      aria-label={`Delete ${row.name}`}
                      onClick={() => onDeleteHoliday(row.id)}
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })
          ) : (
            <p className="workforce-management-empty">No holidays this period.</p>
          )}
        </div>
      </div>
    </aside>
  );
}
