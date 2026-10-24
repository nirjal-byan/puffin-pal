"use client";

import type { Permission } from "@puffinpal/permissions";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DatePicker } from "../../../components/date-picker";
import { Dropdown } from "../../../components/dropdown";
import { FormModal } from "../../../components/form-modal";
import { errorMessage, type WorkspaceApi } from "../../../lib/api";
import { loadEmployees } from "../../workforce/api";
import type { EmployeeOption } from "../../workforce/types";

type Settings = { timezone: string; unpaidLeaveDeductionsEnabled: boolean };
type CalendarData = {
  timezone: string;
  employees: Array<{ id: string; name: string }>;
  attendance: Array<{ id: string; employeeId: string; workDate: string; status: string }>;
  leave: Array<{
    id: string;
    employeeId: string;
    startDate: string;
    endDate: string;
    status: string;
  }>;
  overtime: Array<{ id: string; employeeId: string; workDate: string }>;
  holidays: Array<{
    id: string;
    name: string;
    date: string;
    isRecurring: boolean;
    durationMinutes?: number;
    version: number;
  }>;
  schedules: Array<{
    id: string;
    employeeId: string;
    name: string;
    timezone: string;
    workdays: string;
    scheduledStartTime: string;
    scheduledEndTime: string;
    expectedDailyMinutes: number;
    breakMinutes: number;
    isActive: boolean;
    effectiveFrom: string;
    effectiveTo?: string;
    version: number;
  }>;
};

function iso(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default function WorkforcePage({
  api,
  permissions,
  onSaved,
}: {
  api: WorkspaceApi;
  permissions: readonly Permission[];
  onSaved: (message: string) => void;
}) {
  const [month, setMonth] = useState(() => new Date());
  const [view, setView] = useState<"month" | "week">("month");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [data, setData] = useState<CalendarData | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<"holiday" | "schedule" | "settings" | null>(null);
  const [editingHolidayId, setEditingHolidayId] = useState<string | null>(null);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [holiday, setHoliday] = useState({
    name: "",
    date: "",
    endDate: "",
    isRecurring: false,
    durationMinutes: undefined as number | undefined,
    expectedVersion: undefined as number | undefined,
  });
  const [schedule, setSchedule] = useState({
    employeeId: "",
    name: "Standard schedule",
    timezone: "UTC",
    workdays: "[1,2,3,4,5]",
    scheduledStartTime: "09:00",
    scheduledEndTime: "17:00",
    expectedDailyMinutes: 480,
    breakMinutes: 0,
    isActive: true,
    effectiveFrom: iso(new Date()),
    effectiveTo: "",
    expectedVersion: undefined as number | undefined,
  });
  const canManage = permissions.includes("attendance:manage");
  const canConfigure = permissions.includes("organization:update");
  const range = useMemo(() => {
    if (view === "week") {
      const anchor = new Date(
        Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), month.getUTCDate()),
      );
      const from = new Date(anchor);
      from.setUTCDate(anchor.getUTCDate() - anchor.getUTCDay());
      const to = new Date(from);
      to.setUTCDate(from.getUTCDate() + 6);
      return { from: iso(from), to: iso(to) };
    }
    const from = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1));
    const to = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0));
    return { from: iso(from), to: iso(to) };
  }, [month, view]);
  const load = useCallback(async () => {
    const [calendar, configuration, people] = await Promise.all([
      api<CalendarData>(`/workforce/calendar?from=${range.from}&to=${range.to}`),
      api<Settings>("/workforce/settings"),
      loadEmployees(api),
    ]);
    setData(calendar);
    setSettings(configuration);
    setEmployees(people);
    setSchedule((current) => ({ ...current, timezone: configuration.timezone }));
  }, [api, range]);
  useEffect(() => {
    let active = true;
    Promise.all([
      api<CalendarData>(`/workforce/calendar?from=${range.from}&to=${range.to}`),
      api<Settings>("/workforce/settings"),
      loadEmployees(api),
    ])
      .then(([calendar, configuration, people]) => {
        if (!active) return;
        setData(calendar);
        setSettings(configuration);
        setEmployees(people);
        setSchedule((current) => ({ ...current, timezone: configuration.timezone }));
      })
      .catch((failure) => {
        if (active) setError(errorMessage(failure));
      });
    return () => {
      active = false;
    };
  }, [api, range]);
  const days = useMemo(() => {
    const first = new Date(`${range.from}T00:00:00Z`);
    const count = view === "week" ? 7 : new Date(`${range.to}T00:00:00Z`).getUTCDate();
    return [
      ...Array.from({ length: view === "month" ? first.getUTCDay() : 0 }, () => null),
      ...Array.from({ length: count }, (_, index) =>
        iso(new Date(first.getTime() + index * 86400000)),
      ),
    ];
  }, [range, view]);
  async function saveHoliday() {
    try {
      const spansMultipleDays = Boolean(holiday.endDate && holiday.endDate !== holiday.date);
      await api(
        editingHolidayId ? `/attendance/holidays/${editingHolidayId}` : "/attendance/holidays",
        {
          method: editingHolidayId ? "PATCH" : "POST",
          body: {
            ...holiday,
            endDate: editingHolidayId ? undefined : holiday.endDate || undefined,
          },
        },
      );
      setEditingHolidayId(null);
      setOpen(null);
      await load();
      onSaved(spansMultipleDays ? "Holiday range created." : "Holiday created.");
      setHoliday({
        name: "",
        date: "",
        endDate: "",
        isRecurring: false,
        durationMinutes: undefined,
        expectedVersion: undefined,
      });
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }
  async function saveSchedule() {
    await api(
      editingScheduleId ? `/attendance/schedules/${editingScheduleId}` : "/attendance/schedules",
      {
        method: editingScheduleId ? "PATCH" : "POST",
        body: { ...schedule, effectiveTo: schedule.effectiveTo || undefined },
      },
    );
    setEditingScheduleId(null);
    setOpen(null);
    await load();
    onSaved("Work schedule assigned.");
  }
  async function saveSettings() {
    if (!settings) return;
    await api("/workforce/settings", { method: "PATCH", body: settings });
    setOpen(null);
    await load();
    onSaved("Workforce settings updated.");
  }
  function editHoliday(row: CalendarData["holidays"][number]) {
    setHoliday({
      name: row.name,
      date: row.date.slice(0, 10),
      endDate: "",
      isRecurring: row.isRecurring,
      durationMinutes: row.durationMinutes,
      expectedVersion: row.version,
    });
    setEditingHolidayId(row.id);
    setOpen("holiday");
  }
  async function deleteHoliday(id: string) {
    try {
      await api(`/attendance/holidays/${id}`, { method: "DELETE" });
      await load();
      onSaved("Holiday deleted.");
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }
  function editSchedule(row: CalendarData["schedules"][number]) {
    setSchedule({
      employeeId: row.employeeId,
      name: row.name,
      timezone: row.timezone,
      workdays: row.workdays,
      scheduledStartTime: row.scheduledStartTime,
      scheduledEndTime: row.scheduledEndTime,
      expectedDailyMinutes: row.expectedDailyMinutes,
      breakMinutes: row.breakMinutes,
      isActive: row.isActive,
      effectiveFrom: row.effectiveFrom.slice(0, 10),
      effectiveTo: row.effectiveTo?.slice(0, 10) ?? "",
      expectedVersion: row.version,
    });
    setEditingScheduleId(row.id);
    setOpen("schedule");
  }
  function events(date: string) {
    if (!data) return [];
    return [
      ...data.holidays
        .filter((row) => row.date.slice(0, 10) === date)
        .map((row) => ({ label: row.name, kind: "holiday" })),
      ...data.leave
        .filter(
          (row) =>
            (!employeeFilter || row.employeeId === employeeFilter) &&
            row.startDate.slice(0, 10) <= date &&
            row.endDate.slice(0, 10) >= date,
        )
        .map((row) => ({
          label: row.status === "APPROVED" ? "Approved leave" : "Pending leave",
          kind: "leave",
        })),
      ...data.attendance
        .filter(
          (row) =>
            (!employeeFilter || row.employeeId === employeeFilter) &&
            row.workDate.slice(0, 10) === date,
        )
        .map((row) => ({ label: row.status.replaceAll("_", " "), kind: "attendance" })),
      ...data.overtime
        .filter(
          (row) =>
            (!employeeFilter || row.employeeId === employeeFilter) &&
            row.workDate.slice(0, 10) === date,
        )
        .map(() => ({ label: "Approved overtime", kind: "overtime" })),
    ].slice(0, 3);
  }
  return (
    <>
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      <section className="panel workforce-toolbar">
        <div>
          <h3>Workforce calendar</h3>
          <p className="muted">
            Attendance, leave, holidays, schedules, and overtime in{" "}
            {data?.timezone ?? "your organization timezone"}.
          </p>
        </div>
        <div className="workforce-calendar-filters">
          <Dropdown
            name="calendarEmployee"
            label="Employee filter"
            value={employeeFilter}
            onChange={setEmployeeFilter}
            options={[
              { value: "", label: "All authorized employees" },
              ...employees.map((employee) => ({
                value: employee.id,
                label: `${employee.firstName} ${employee.lastName}`,
              })),
            ]}
          />
          <div className="segmented-control">
            <button
              type="button"
              className={view === "month" ? "active" : ""}
              onClick={() => setView("month")}
            >
              Month
            </button>
            <button
              type="button"
              className={view === "week" ? "active" : ""}
              onClick={() => setView("week")}
            >
              Week
            </button>
          </div>
          {canConfigure && (
            <button className="button secondary" onClick={() => setOpen("settings")}>
              Settings
            </button>
          )}
        </div>
      </section>
      <div className={`workforce-calendar-layout ${canManage ? "has-management" : ""}`}>
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
                onClick={() =>
                  setMonth(
                    new Date(
                      Date.UTC(
                        month.getUTCFullYear(),
                        month.getUTCMonth() + (view === "month" ? -1 : 0),
                        month.getUTCDate() + (view === "week" ? -7 : 0),
                      ),
                    ),
                  )
                }
              >
                ‹
              </button>
              <button
                type="button"
                className="button secondary workforce-today"
                onClick={() => setMonth(new Date())}
              >
                Today
              </button>
              <button
                type="button"
                className="workforce-calendar-nav"
                aria-label={`Next ${view}`}
                onClick={() =>
                  setMonth(
                    new Date(
                      Date.UTC(
                        month.getUTCFullYear(),
                        month.getUTCMonth() + (view === "month" ? 1 : 0),
                        month.getUTCDate() + (view === "week" ? 7 : 0),
                      ),
                    ),
                  )
                }
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
                <article className={date === iso(new Date()) ? "is-today" : undefined} key={date}>
                  <strong>{Number(date.slice(-2))}</strong>
                  {events(date).map((event, eventIndex) => (
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
        {canManage && data && (
          <aside className="panel workforce-management-panel">
            <div className="workforce-management-group">
              <div className="workforce-management-heading">
                <div>
                  <span className="eyebrow">Schedules</span>
                  <h3>Work patterns</h3>
                </div>
                <button className="button secondary compact" onClick={() => setOpen("schedule")}>
                  + Assign
                </button>
              </div>
              <div className="workforce-management-list">
                {data.schedules.length ? (
                  data.schedules.map((row) => (
                    <button type="button" key={row.id} onClick={() => editSchedule(row)}>
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
                <button className="button primary compact" onClick={() => setOpen("holiday")}>
                  + Add
                </button>
              </div>
              <div className="workforce-management-list">
                {data.holidays.length ? (
                  data.holidays.map((row) => (
                    <div className="workforce-management-item" key={row.id}>
                      <button
                        type="button"
                        disabled={row.date.slice(0, 10) < iso(new Date())}
                        title={
                          row.date.slice(0, 10) < iso(new Date())
                            ? "Historical holidays are locked"
                            : "Edit holiday"
                        }
                        onClick={() => editHoliday(row)}
                      >
                        <span>
                          <strong>{row.name}</strong>
                          <small>{row.date.slice(0, 10)}</small>
                        </span>
                        <span className="workforce-status">
                          {row.date.slice(0, 10) < iso(new Date())
                            ? "Historical"
                            : row.isRecurring
                              ? "Annual"
                              : "Once"}
                        </span>
                      </button>
                      {row.date.slice(0, 10) >= iso(new Date()) && (
                        <button
                          className="workforce-delete"
                          aria-label={`Delete ${row.name}`}
                          onClick={() => void deleteHoliday(row.id)}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="workforce-management-empty">No holidays this period.</p>
                )}
              </div>
            </div>
          </aside>
        )}
      </div>
      {open === "holiday" && (
        <FormModal
          title={editingHolidayId ? "Edit holiday" : "Add holiday"}
          badge="Calendar"
          onClose={() => {
            setOpen(null);
            setEditingHolidayId(null);
          }}
          onSubmit={saveHoliday}
          submitLabel="Save holiday"
        >
          <div className="standard-form-grid">
            <label>
              Holiday name
              <input
                value={holiday.name}
                onChange={(event) => setHoliday({ ...holiday, name: event.target.value })}
              />
            </label>
            <label>
              {editingHolidayId ? "Date" : "Starts on"}
              <DatePicker
                value={holiday.date}
                onChange={(date) => setHoliday({ ...holiday, date })}
                ariaLabel="Holiday date"
              />
            </label>
            {!editingHolidayId && (
              <label>
                Ends on <small>Optional</small>
                <DatePicker
                  value={holiday.endDate}
                  min={holiday.date || undefined}
                  onChange={(endDate) => setHoliday({ ...holiday, endDate })}
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
                  setHoliday({
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
              onChange={(event) => setHoliday({ ...holiday, isRecurring: event.target.checked })}
            />
            <span>
              <strong>Repeat every year</strong>
              <small>Uses the same month and day each year.</small>
            </span>
          </label>
        </FormModal>
      )}
      {open === "schedule" && (
        <FormModal
          title={editingScheduleId ? "Edit work schedule" : "Assign work schedule"}
          badge="Schedule"
          onClose={() => {
            setOpen(null);
            setEditingScheduleId(null);
          }}
          onSubmit={saveSchedule}
          submitLabel="Save schedule"
        >
          <div className="standard-form-grid">
            <label>
              Schedule name
              <input
                value={schedule.name}
                onChange={(event) => setSchedule({ ...schedule, name: event.target.value })}
              />
            </label>
            <label>
              Employee
              <Dropdown
                name="scheduleEmployee"
                label="Employee"
                value={schedule.employeeId}
                onChange={(employeeId) => setSchedule({ ...schedule, employeeId })}
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
                onChange={(event) => setSchedule({ ...schedule, timezone: event.target.value })}
              />
            </label>
            <label>
              Workdays
              <Dropdown
                name="scheduleWorkdays"
                label="Workdays"
                searchable={false}
                value={schedule.workdays}
                onChange={(workdays) => setSchedule({ ...schedule, workdays })}
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
                onChange={(event) =>
                  setSchedule({ ...schedule, scheduledStartTime: event.target.value })
                }
              />
            </label>
            <label>
              End time
              <input
                type="time"
                value={schedule.scheduledEndTime}
                onChange={(event) =>
                  setSchedule({ ...schedule, scheduledEndTime: event.target.value })
                }
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
                  setSchedule({ ...schedule, expectedDailyMinutes: Number(event.target.value) })
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
                  setSchedule({ ...schedule, breakMinutes: Number(event.target.value) })
                }
              />
            </label>
            <label>
              Effective from
              <DatePicker
                value={schedule.effectiveFrom}
                onChange={(effectiveFrom) => setSchedule({ ...schedule, effectiveFrom })}
                ariaLabel="Schedule effective date"
              />
            </label>
            <label>
              Effective to <small>Optional</small>
              <DatePicker
                value={schedule.effectiveTo}
                onChange={(effectiveTo) => setSchedule({ ...schedule, effectiveTo })}
                ariaLabel="Schedule end date"
              />
            </label>
          </div>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={schedule.isActive}
              onChange={(event) => setSchedule({ ...schedule, isActive: event.target.checked })}
            />
            <span>
              <strong>Active schedule</strong>
              <small>Inactive schedules remain available in history.</small>
            </span>
          </label>
        </FormModal>
      )}
      {open === "settings" && settings && (
        <FormModal
          title="Workforce settings"
          badge="Organization"
          onClose={() => setOpen(null)}
          onSubmit={saveSettings}
          submitLabel="Save settings"
        >
          <label>
            Organization timezone
            <input
              value={settings.timezone}
              onChange={(event) => setSettings({ ...settings, timezone: event.target.value })}
            />
            <small>Schedules override this timezone for their assigned employees.</small>
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={settings.unpaidLeaveDeductionsEnabled}
              onChange={(event) =>
                setSettings({ ...settings, unpaidLeaveDeductionsEnabled: event.target.checked })
              }
            />
            <span>
              <strong>Enable unpaid-leave deduction proposals</strong>
              <small>Deductions still require explicit import into a payroll draft.</small>
            </span>
          </label>
        </FormModal>
      )}
    </>
  );
}
