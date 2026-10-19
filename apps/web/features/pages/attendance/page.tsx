"use client";
import type { Permission } from "@puffinpal/permissions";
import { useCallback, useEffect, useState } from "react";
import { AppModal } from "../../../components/app-modal";
import { errorMessage, type WorkspaceApi } from "../../../lib/api";
import { loadAttendance, loadAttendanceSummary, loadEmployees } from "../../workforce/api";
import type { AttendanceRecord, AttendanceSummary, EmployeeOption } from "../../workforce/types";
import { employeeName, shortDate } from "../../workforce/types";
import { MetricCard, StatusBadge, WorkforceEmpty } from "../../workforce/workforce-ui";

export default function AttendancePage({
  api,
  permissions,
  onSaved,
}: {
  api: WorkspaceApi;
  permissions: readonly Permission[];
  onSaved: (message: string) => void;
}) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    employeeId: "",
    workDate: new Date().toISOString().slice(0, 10),
    status: "PRESENT",
    notes: "",
  });
  const can = (permission: Permission) => permissions.includes(permission);
  const refresh = useCallback(async () => {
    const [attendance, totals, people] = await Promise.all([
      loadAttendance(api),
      loadAttendanceSummary(api),
      loadEmployees(api),
    ]);
    setRecords(attendance);
    setSummary(totals);
    setEmployees(people);
  }, [api]);
  useEffect(() => {
    let active = true;
    Promise.all([loadAttendance(api), loadAttendanceSummary(api), loadEmployees(api)])
      .then(([attendance, totals, people]) => {
        if (!active) return;
        setRecords(attendance);
        setSummary(totals);
        setEmployees(people);
      })
      .catch((failure) => {
        if (active) setError(errorMessage(failure));
      });
    return () => {
      active = false;
    };
  }, [api]);
  async function selfAction(action: "check-in" | "check-out") {
    setError("");
    try {
      await api(`/attendance/${action}`, { method: "POST" });
      await refresh();
      onSaved(action === "check-in" ? "Checked in." : "Checked out.");
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }
  async function save() {
    setError("");
    try {
      await api("/attendance", { method: "POST", body: form });
      setOpen(false);
      await refresh();
      onSaved("Attendance recorded.");
    } catch (failure) {
      setError(errorMessage(failure));
    }
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
                onClick={() => selfAction("check-in")}
              >
                Check in
              </button>
              <button className="button secondary" onClick={() => selfAction("check-out")}>
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
      <section className="panel">
        <div className="panel-heading">
          <h3>Attendance history</h3>
          <span className="muted">{records.length} records</span>
        </div>
        {!records.length ? (
          <WorkforceEmpty
            title="No attendance recorded"
            detail="Check-ins and manager entries will appear here."
          />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Time</th>
                  <th>Worked</th>
                </tr>
              </thead>
              <tbody>
                {records.map((row) => (
                  <tr key={row.id}>
                    <td>{employeeName(employees, row.employeeId)}</td>
                    <td>{shortDate(row.workDate)}</td>
                    <td>
                      <StatusBadge status={row.status} />
                      {row.isLate && <small className="workforce-inline-note">Late</small>}
                    </td>
                    <td>
                      {row.checkInAt
                        ? new Date(row.checkInAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}{" "}
                      –{" "}
                      {row.checkOutAt
                        ? new Date(row.checkOutAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                    <td>
                      {row.workedMinutes
                        ? `${Math.floor(row.workedMinutes / 60)}h ${row.workedMinutes % 60}m`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {open && (
        <AppModal title="Record attendance" onClose={() => setOpen(false)}>
          <div className="compact-form">
            <label>
              Employee
              <select
                value={form.employeeId}
                onChange={(event) => setForm({ ...form, employeeId: event.target.value })}
              >
                <option value="">Select employee</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.firstName} {employee.lastName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Work date
              <input
                type="date"
                value={form.workDate}
                onChange={(event) => setForm({ ...form, workDate: event.target.value })}
              />
            </label>
            <label>
              Status
              <select
                value={form.status}
                onChange={(event) => setForm({ ...form, status: event.target.value })}
              >
                {["PRESENT", "ABSENT", "HALF_DAY", "ON_LEAVE", "HOLIDAY"].map((status) => (
                  <option key={status}>{status.replaceAll("_", " ")}</option>
                ))}
              </select>
            </label>
            <label>
              Notes
              <textarea
                rows={3}
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
              />
            </label>
            <div className="form-actions">
              <button className="button secondary" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button className="button primary" disabled={!form.employeeId} onClick={save}>
                Save attendance
              </button>
            </div>
          </div>
        </AppModal>
      )}
    </>
  );
}
