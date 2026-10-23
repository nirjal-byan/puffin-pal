"use client";
import type { Permission } from "@puffinpal/permissions";
import { useCallback, useEffect, useState } from "react";
import { FormModal } from "../../../components/form-modal";
import { DatePicker } from "../../../components/date-picker";
import { Dropdown } from "../../../components/dropdown";
import { errorMessage, type WorkspaceApi } from "../../../lib/api";
import { loadAttendance, loadAttendanceSummary, loadEmployees } from "../../workforce/api";
import type {
  AttendanceCorrection,
  AttendanceRecord,
  AttendanceSummary,
  EmployeeOption,
} from "../../workforce/types";
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
  const [corrections, setCorrections] = useState<AttendanceCorrection[]>([]);
  const [ownRecordIds, setOwnRecordIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [correcting, setCorrecting] = useState<AttendanceRecord | null>(null);
  const [correction, setCorrection] = useState({
    proposedStatus: "PRESENT",
    proposedWorkedMinutes: 0,
    reason: "",
  });
  const [form, setForm] = useState({
    employeeId: "",
    workDate: new Date().toISOString().slice(0, 10),
    status: "PRESENT",
    notes: "",
  });
  const can = (permission: Permission) => permissions.includes(permission);
  const refresh = useCallback(async () => {
    const [attendance, totals, people, correctionRows, mine] = await Promise.all([
      loadAttendance(api),
      loadAttendanceSummary(api),
      loadEmployees(api),
      api<AttendanceCorrection[]>("/attendance/corrections"),
      api<AttendanceRecord[]>("/attendance/mine").catch(() => []),
    ]);
    setRecords(attendance);
    setSummary(totals);
    setEmployees(people);
    setCorrections(correctionRows);
    setOwnRecordIds(new Set(mine.map((row) => row.id)));
  }, [api]);
  useEffect(() => {
    let active = true;
    Promise.all([
      loadAttendance(api),
      loadAttendanceSummary(api),
      loadEmployees(api),
      api<AttendanceCorrection[]>("/attendance/corrections"),
      api<AttendanceRecord[]>("/attendance/mine").catch(() => []),
    ])
      .then(([attendance, totals, people, correctionRows, mine]) => {
        if (!active) return;
        setRecords(attendance);
        setSummary(totals);
        setEmployees(people);
        setCorrections(correctionRows);
        setOwnRecordIds(new Set(mine.map((row) => row.id)));
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
  async function requestCorrection() {
    if (!correcting) return;
    try {
      await api("/attendance/corrections", {
        method: "POST",
        body: { attendanceRecordId: correcting.id, ...correction },
      });
      setCorrecting(null);
      await refresh();
      onSaved("Attendance correction requested.");
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }
  async function reviewCorrection(row: AttendanceCorrection, action: "approve" | "reject") {
    try {
      await api(`/attendance/corrections/${row.id}/${action}`, {
        method: "POST",
        body: {
          expectedVersion: row.version,
          ...(action === "reject" ? { reason: "Correction rejected" } : {}),
        },
      });
      await refresh();
      onSaved(`Correction ${action}d.`);
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
                  <th />
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
                      {ownRecordIds.has(row.id) &&
                        !corrections.some(
                          (item) => item.attendanceRecordId === row.id && item.status === "PENDING",
                        ) && (
                          <button
                            className="text-button"
                            onClick={() => {
                              setCorrecting(row);
                              setCorrection({
                                proposedStatus: row.status,
                                proposedWorkedMinutes: row.workedMinutes ?? 0,
                                reason: "",
                              });
                            }}
                          >
                            Request correction
                          </button>
                        )}
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
      {can("attendance:manage") && corrections.some((row) => row.status === "PENDING") && (
        <section className="panel">
          <div className="panel-heading">
            <h3>Pending corrections</h3>
            <span className="muted">Manager review</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Requested change</th>
                  <th>Reason</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {corrections
                  .filter((row) => row.status === "PENDING")
                  .map((row) => (
                    <tr key={row.id}>
                      <td>{employeeName(employees, row.employeeId)}</td>
                      <td>
                        {row.proposedStatus.replaceAll("_", " ")} · {row.proposedWorkedMinutes ?? 0}{" "}
                        minutes
                      </td>
                      <td>{row.reason}</td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="text-button"
                            onClick={() => void reviewCorrection(row, "approve")}
                          >
                            Approve
                          </button>
                          <button
                            className="text-button danger-text"
                            onClick={() => void reviewCorrection(row, "reject")}
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {open && (
        <FormModal title="Record attendance" badge="Attendance" onClose={() => setOpen(false)}>
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
                    onChange={(employeeId) => setForm({ ...form, employeeId })}
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
                    onChange={(workDate) => setForm({ ...form, workDate })}
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
                    onChange={(status) => setForm({ ...form, status })}
                    options={["PRESENT", "ABSENT", "HALF_DAY", "ON_LEAVE", "HOLIDAY"].map(
                      (status) => ({ value: status, label: status.replaceAll("_", " ") }),
                    )}
                  />
                </label>
              </div>
              <label>
                Notes <small>Optional context for this record</small>
                <textarea
                  rows={3}
                  placeholder="Add context about this attendance record"
                  value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                />
              </label>
            </section>
            <div className="workforce-form-actions">
              <button className="button secondary" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button className="button primary" disabled={!form.employeeId} onClick={save}>
                Save attendance
              </button>
            </div>
          </div>
        </FormModal>
      )}
      {correcting && (
        <FormModal
          title="Request attendance correction"
          badge={shortDate(correcting.workDate)}
          onClose={() => setCorrecting(null)}
          onSubmit={requestCorrection}
          submitLabel="Submit request"
        >
          <div className="standard-form-grid">
            <label>
              Correct status
              <Dropdown
                name="correctionStatus"
                label="Correct status"
                searchable={false}
                value={correction.proposedStatus}
                onChange={(proposedStatus) => setCorrection({ ...correction, proposedStatus })}
                options={["PRESENT", "ABSENT", "HALF_DAY", "ON_LEAVE", "HOLIDAY"].map((value) => ({
                  value,
                  label: value.replaceAll("_", " "),
                }))}
              />
            </label>
            <label>
              Worked minutes
              <input
                type="number"
                min="0"
                max="1440"
                value={correction.proposedWorkedMinutes}
                onChange={(event) =>
                  setCorrection({
                    ...correction,
                    proposedWorkedMinutes: Number(event.target.value),
                  })
                }
              />
            </label>
          </div>
          <label>
            Why is this correction needed?
            <textarea
              rows={4}
              value={correction.reason}
              onChange={(event) => setCorrection({ ...correction, reason: event.target.value })}
            />
          </label>
        </FormModal>
      )}
    </>
  );
}
