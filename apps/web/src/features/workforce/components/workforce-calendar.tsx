import type { EmployeeOption } from "../types";
import type { WorkforceCalendarEvent, WorkforceCalendarView } from "../calendar-types";
import { Dropdown } from "@/components/ui/dropdown";
import { workforceIsoDate } from "../calendar-utils";
import type { ReactNode } from "react";

export function WorkforceCalendar({
  month,
  view,
  range,
  days,
  timezone,
  employees,
  employeeFilter,
  canConfigure,
  onEmployeeFilter,
  onView,
  onMonth,
  onOpenSettings,
  eventsForDate,
  management,
}: {
  month: Date;
  view: WorkforceCalendarView;
  range: { from: string; to: string };
  days: Array<string | null>;
  timezone?: string;
  employees: EmployeeOption[];
  employeeFilter: string;
  canConfigure: boolean;
  onEmployeeFilter: (value: string) => void;
  onView: (value: WorkforceCalendarView) => void;
  onMonth: (value: Date) => void;
  onOpenSettings: () => void;
  eventsForDate: (date: string) => WorkforceCalendarEvent[];
  management?: ReactNode;
}) {
  const move = (direction: -1 | 1) =>
    onMonth(
      new Date(
        Date.UTC(
          month.getUTCFullYear(),
          month.getUTCMonth() + (view === "month" ? direction : 0),
          month.getUTCDate() + (view === "week" ? direction * 7 : 0),
        ),
      ),
    );

  return (
    <>
      <section className="panel workforce-toolbar">
        <div>
          <h3>Workforce calendar</h3>
          <p className="muted">
            Attendance, leave, holidays, schedules, and overtime in{" "}
            {timezone ?? "your organization timezone"}.
          </p>
        </div>
        <div className="workforce-calendar-filters">
          <Dropdown
            name="calendarEmployee"
            label="Employee filter"
            value={employeeFilter}
            onChange={onEmployeeFilter}
            options={[
              { value: "", label: "All authorized employees" },
              ...employees.map((employee) => ({
                value: employee.id,
                label: `${employee.firstName} ${employee.lastName}`,
              })),
            ]}
          />
          <div className="segmented-control">
            {(["month", "week"] as const).map((option) => (
              <button
                type="button"
                className={view === option ? "active" : ""}
                onClick={() => onView(option)}
                key={option}
              >
                {option === "month" ? "Month" : "Week"}
              </button>
            ))}
          </div>
          {canConfigure && (
            <button className="button secondary" onClick={onOpenSettings}>
              Settings
            </button>
          )}
        </div>
      </section>
      <div className={`workforce-calendar-layout ${management ? "has-management" : ""}`}>
        <section className="panel workforce-calendar-panel">
          <div className="panel-heading workforce-calendar-heading">
            <div className="workforce-calendar-period">
              <h3>
                {view === "month"
                  ? month.toLocaleDateString(undefined, {
                      month: "long",
                      year: "numeric",
                      timeZone: "UTC",
                    })
                  : `${range.from} – ${range.to}`}
              </h3>
              <span>{view === "month" ? "Monthly overview" : "Weekly overview"}</span>
            </div>
            <div className="workforce-calendar-navigation">
              <button
                type="button"
                className="workforce-calendar-nav"
                aria-label={`Previous ${view}`}
                onClick={() => move(-1)}
              >
                ‹
              </button>
              <button
                type="button"
                className="button secondary workforce-today"
                onClick={() => onMonth(new Date())}
              >
                Today
              </button>
              <button
                type="button"
                className="workforce-calendar-nav"
                aria-label={`Next ${view}`}
                onClick={() => move(1)}
              >
                ›
              </button>
            </div>
          </div>
          <div className="workforce-calendar-weekdays">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className={`workforce-calendar-grid ${view === "week" ? "is-week" : ""}`}>
            {days.map((date, index) =>
              date ? (
                <article
                  className={date === workforceIsoDate(new Date()) ? "is-today" : undefined}
                  key={date}
                >
                  <strong>{Number(date.slice(-2))}</strong>
                  {eventsForDate(date).map((event, eventIndex) => (
                    <span
                      className={`workforce-calendar-event ${event.kind}`}
                      key={`${event.kind}-${eventIndex}`}
                    >
                      {event.label}
                    </span>
                  ))}
                </article>
              ) : (
                <span key={`empty-${index}`} />
              ),
            )}
          </div>
        </section>
        {management}
      </div>
    </>
  );
}
