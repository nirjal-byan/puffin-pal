"use client";

import type { Permission } from "@puffinpal/permissions";
import { useCallback, useEffect, useMemo, useState } from "react";
import { errorMessage, type WorkspaceApi } from "@/lib/api";
import { loadEmployees } from "@/features/workforce/api";
import type { EmployeeOption } from "@/features/workforce/types";
import type {
  WorkforceCalendarData as CalendarData,
  WorkforceHolidayForm,
  WorkforceScheduleForm,
  WorkforceSettings as Settings,
} from "../calendar-types";
import { workforceCalendarRange, workforceIsoDate as iso } from "../calendar-utils";
import { WorkforceManagementPanel } from "./workforce-management-panel";
import { WorkforceCalendar } from "./workforce-calendar";
import { WorkforceHolidayDialog } from "./workforce-holiday-dialog";
import { WorkforceScheduleDialog } from "./workforce-schedule-dialog";
import { WorkforceSettingsDialog } from "./workforce-settings-dialog";

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
  const [holiday, setHoliday] = useState<WorkforceHolidayForm>({
    name: "",
    date: "",
    endDate: "",
    isRecurring: false,
    durationMinutes: undefined as number | undefined,
    expectedVersion: undefined as number | undefined,
  });
  const [schedule, setSchedule] = useState<WorkforceScheduleForm>({
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
  const range = useMemo(() => workforceCalendarRange(month, view), [month, view]);
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
      <WorkforceCalendar
        month={month}
        view={view}
        range={range}
        days={days}
        timezone={data?.timezone}
        employees={employees}
        employeeFilter={employeeFilter}
        canConfigure={canConfigure}
        onEmployeeFilter={setEmployeeFilter}
        onView={setView}
        onMonth={setMonth}
        onOpenSettings={() => setOpen("settings")}
        eventsForDate={events}
        management={
          canManage && data ? (
            <WorkforceManagementPanel
              data={data}
              onAddSchedule={() => setOpen("schedule")}
              onAddHoliday={() => setOpen("holiday")}
              onEditSchedule={editSchedule}
              onEditHoliday={editHoliday}
              onDeleteHoliday={(id) => void deleteHoliday(id)}
            />
          ) : undefined
        }
      />
      {open === "holiday" && (
        <WorkforceHolidayDialog
          holiday={holiday}
          editing={Boolean(editingHolidayId)}
          onChange={setHoliday}
          onClose={() => {
            setOpen(null);
            setEditingHolidayId(null);
          }}
          onSubmit={saveHoliday}
        />
      )}
      {open === "schedule" && (
        <WorkforceScheduleDialog
          schedule={schedule}
          employees={employees}
          editing={Boolean(editingScheduleId)}
          onChange={setSchedule}
          onClose={() => {
            setOpen(null);
            setEditingScheduleId(null);
          }}
          onSubmit={saveSchedule}
        />
      )}
      {open === "settings" && settings && (
        <WorkforceSettingsDialog
          settings={settings}
          onChange={setSettings}
          onClose={() => setOpen(null)}
          onSubmit={saveSettings}
        />
      )}
    </>
  );
}
