import type { AttendanceCorrection, AttendanceRecord, EmployeeOption } from "../types";
import { employeeName, shortDate } from "../types";
import { StatusBadge, WorkforceEmpty } from "../workforce-ui";

export function AttendanceRecordsTable({
  records,
  employees,
  corrections,
  ownRecordIds,
  onCorrect,
}: {
  records: AttendanceRecord[];
  employees: EmployeeOption[];
  corrections: AttendanceCorrection[];
  ownRecordIds: Set<string>;
  onCorrect: (row: AttendanceRecord) => void;
}) {
  return (
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
                        <button className="text-button" onClick={() => onCorrect(row)}>
                          Request correction
                        </button>
                      )}
                  </td>
                  <td>
                    {formatTime(row.checkInAt)} – {formatTime(row.checkOutAt)}
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
  );
}

export function PendingCorrectionsTable({
  corrections,
  employees,
  onReview,
}: {
  corrections: AttendanceCorrection[];
  employees: EmployeeOption[];
  onReview: (row: AttendanceCorrection, action: "approve" | "reject") => void;
}) {
  const pending = corrections.filter((row) => row.status === "PENDING");
  if (!pending.length) return null;
  return (
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
            {pending.map((row) => (
              <tr key={row.id}>
                <td>{employeeName(employees, row.employeeId)}</td>
                <td>
                  {row.proposedStatus.replaceAll("_", " ")} · {row.proposedWorkedMinutes ?? 0}{" "}
                  minutes
                </td>
                <td>{row.reason}</td>
                <td>
                  <div className="row-actions">
                    <button className="text-button" onClick={() => onReview(row, "approve")}>
                      Approve
                    </button>
                    <button
                      className="text-button danger-text"
                      onClick={() => onReview(row, "reject")}
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
  );
}

function formatTime(value?: string) {
  return value
    ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "—";
}
