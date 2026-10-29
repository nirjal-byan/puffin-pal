"use client";
import type { Permission } from "@puffinpal/permissions";
import { useCallback, useEffect, useState } from "react";
import { errorMessage, type WorkspaceApi } from "@/lib/api";
import { loadAttendance, loadAttendanceSummary, loadEmployees } from "../api";
import type {
  AttendanceCorrection,
  AttendanceRecord,
  AttendanceSummary,
  EmployeeOption,
} from "../types";
import { MetricCard } from "../workforce-ui";
import {
  AttendanceCorrectionDialog,
  RecordAttendanceDialog,
  type AttendanceForm,
  type CorrectionForm,
} from "./attendance-dialogs";
import { AttendanceRecordsTable, PendingCorrectionsTable } from "./attendance-tables";

export default function AttendancePage({
  api,
  permissions,
  onSaved,
}: {
  api: WorkspaceApi;
  permissions: readonly Permission[];
  onSaved: (message: string) => void;
}) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]),
    [summary, setSummary] = useState<AttendanceSummary | null>(null),
    [employees, setEmployees] = useState<EmployeeOption[]>([]),
    [corrections, setCorrections] = useState<AttendanceCorrection[]>([]),
    [ownRecordIds, setOwnRecordIds] = useState<Set<string>>(new Set()),
    [error, setError] = useState(""),
    [open, setOpen] = useState(false),
    [correcting, setCorrecting] = useState<AttendanceRecord | null>(null);
  const [correction, setCorrection] = useState<CorrectionForm>({
    proposedStatus: "PRESENT",
    proposedWorkedMinutes: 0,
    reason: "",
  });
  const [form, setForm] = useState<AttendanceForm>({
    employeeId: "",
    workDate: new Date().toISOString().slice(0, 10),
    status: "PRESENT",
    notes: "",
  });
  const can = (permission: Permission) => permissions.includes(permission);
  const applyData = (
    data: [
      AttendanceRecord[],
      AttendanceSummary,
      EmployeeOption[],
      AttendanceCorrection[],
      AttendanceRecord[],
    ],
  ) => {
    setRecords(data[0]);
    setSummary(data[1]);
    setEmployees(data[2]);
    setCorrections(data[3]);
    setOwnRecordIds(new Set(data[4].map((row) => row.id)));
  };
  const requestData = useCallback(
    () =>
      Promise.all([
        loadAttendance(api),
        loadAttendanceSummary(api),
        loadEmployees(api),
        api<AttendanceCorrection[]>("/attendance/corrections"),
        api<AttendanceRecord[]>("/attendance/mine").catch(() => []),
      ]),
    [api],
  );
  const refresh = useCallback(async () => applyData(await requestData()), [requestData]);
  useEffect(() => {
    let active = true;
    requestData()
      .then((data) => {
        if (active) applyData(data);
      })
      .catch((failure) => {
        if (active) setError(errorMessage(failure));
      });
    return () => {
      active = false;
    };
  }, [requestData]);
  async function mutate(action: () => Promise<unknown>, message: string) {
    setError("");
    try {
      await action();
      await refresh();
      onSaved(message);
      return true;
    } catch (failure) {
      setError(errorMessage(failure));
      return false;
    }
  }
  const selfAction = (action: "check-in" | "check-out") =>
    mutate(
      () => api(`/attendance/${action}`, { method: "POST" }),
      action === "check-in" ? "Checked in." : "Checked out.",
    );
  async function save() {
    if (
      await mutate(() => api("/attendance", { method: "POST", body: form }), "Attendance recorded.")
    )
      setOpen(false);
  }
  async function requestCorrection() {
    if (!correcting) return;
    if (
      await mutate(
        () =>
          api("/attendance/corrections", {
            method: "POST",
            body: { attendanceRecordId: correcting.id, ...correction },
          }),
        "Attendance correction requested.",
      )
    )
      setCorrecting(null);
  }
  const reviewCorrection = (row: AttendanceCorrection, action: "approve" | "reject") =>
    mutate(
      () =>
        api(`/attendance/corrections/${row.id}/${action}`, {
          method: "POST",
          body: {
            expectedVersion: row.version,
            ...(action === "reject" ? { reason: "Correction rejected" } : {}),
          },
        }),
      `Correction ${action}d.`,
    );
  function openCorrection(row: AttendanceRecord) {
    setCorrecting(row);
    setCorrection({
      proposedStatus: row.status,
      proposedWorkedMinutes: row.workedMinutes ?? 0,
      reason: "",
    });
  }
  return (
    <>
      {error && (
        <div className="alert" role="alert">
          {error}
        </div>
      )}
      <section className="workforce-metrics" data-tour="attendance-overview">
        <MetricCard
          label="Present"
          value={summary?.presentDays ?? 0}
          detail="Recorded this month"
        />
        <MetricCard
          label="Confirmed absent"
          value={summary?.absentDays ?? 0}
          detail="Manual records only"
        />
        <MetricCard
          label="Late arrivals"
          value={summary?.lateArrivals ?? 0}
          detail="Against work schedules"
        />
        <MetricCard
          label="Worked hours"
          value={((summary?.workedMinutes ?? 0) / 60).toFixed(1)}
          detail={`${summary?.missingRecords ?? 0} records missing`}
        />
      </section>
      <section className="panel workforce-toolbar">
        <div>
          <h3>Daily attendance</h3>
          <p className="muted">Server-timed check-ins and manager corrections.</p>
        </div>
        <div className="row-actions">
          {can("attendance:self") && (
            <>
              <button
                className="button secondary"
                data-tour="attendance-check-in"
                onClick={() => void selfAction("check-in")}
              >
                Check in
              </button>
              <button className="button secondary" onClick={() => void selfAction("check-out")}>
                Check out
              </button>
            </>
          )}
          {can("attendance:manage") && (
            <button
              className="button primary"
              data-tour="record-attendance"
              onClick={() => setOpen(true)}
            >
              + Record attendance
            </button>
          )}
        </div>
      </section>
      <AttendanceRecordsTable
        records={records}
        employees={employees}
        corrections={corrections}
        ownRecordIds={ownRecordIds}
        onCorrect={openCorrection}
      />
      {can("attendance:manage") && (
        <PendingCorrectionsTable
          corrections={corrections}
          employees={employees}
          onReview={(row, action) => void reviewCorrection(row, action)}
        />
      )}
      {open && (
        <RecordAttendanceDialog
          form={form}
          employees={employees}
          onChange={setForm}
          onClose={() => setOpen(false)}
          onSave={() => void save()}
        />
      )}
      {correcting && (
        <AttendanceCorrectionDialog
          record={correcting}
          form={correction}
          onChange={setCorrection}
          onClose={() => setCorrecting(null)}
          onSubmit={requestCorrection}
        />
      )}
    </>
  );
}
