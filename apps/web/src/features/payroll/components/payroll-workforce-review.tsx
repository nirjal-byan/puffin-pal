import type { PayrollDetails, PayrollEntry, WorkforceReview } from "../types";

export function PayrollWorkforceReview({
  run,
  reviews,
  busy,
  onImportOvertime,
  onImportUnpaidLeave,
}: {
  run: PayrollDetails;
  reviews: WorkforceReview[];
  busy: boolean;
  onImportOvertime: (entry: PayrollEntry, overtimeId: string) => void;
  onImportUnpaidLeave: (entry: PayrollEntry, leaveRequestId: string) => void;
}) {
  return (
    <section className="payroll-workforce-review" data-tour="payroll-attendance-review">
      <div className="panel-heading">
        <h3>Attendance review</h3>
        <span className="muted">Review only · no automatic deductions</span>
      </div>
      <div className="payroll-review-grid">
        {reviews.map((review) => {
          const entry = run.entries.find((item) => item.employeeId === review.employeeId);
          return (
            <article key={review.employeeId}>
              <strong>{review.employeeName}</strong>
              <span>
                {review.recordedAttendanceDays} attendance days ·{" "}
                {(review.workedMinutes / 60).toFixed(1)} hours
              </span>
              <span>{review.missingAttendanceRecords} missing records · warning only</span>
              <span>
                {review.approvedPaidLeaveUnits / 2} paid · {review.approvedUnpaidLeaveUnits / 2}{" "}
                unpaid leave days
              </span>
              {(review.unresolvedLeaveRequests > 0 || review.unresolvedOvertimeRequests > 0) && (
                <small>
                  {review.unresolvedLeaveRequests} leave and {review.unresolvedOvertimeRequests}{" "}
                  overtime requests unresolved
                </small>
              )}
              {run.status === "DRAFT" &&
                entry &&
                review.approvedOvertime
                  .filter((item) => !item.imported)
                  .map((item) => (
                    <button
                      key={item.id}
                      className="text-button"
                      disabled={busy || !item.rate}
                      onClick={() => onImportOvertime(entry, item.id)}
                    >
                      {item.rate
                        ? `Import ${item.minutes ?? 0} overtime minutes`
                        : "Overtime rate required"}
                    </button>
                  ))}
              {run.status === "DRAFT" &&
                entry &&
                review.unpaidLeaveDeductionsEnabled &&
                review.approvedUnpaidLeave
                  .filter((item) => !item.imported)
                  .map((item) => (
                    <button
                      key={item.id}
                      className="text-button"
                      disabled={busy}
                      onClick={() => onImportUnpaidLeave(entry, item.id)}
                    >
                      Import {(item.minutes ?? 0) / 60} unpaid leave hours
                    </button>
                  ))}
              {review.approvedUnpaidLeave.some((item) => !item.imported) &&
                !review.unpaidLeaveDeductionsEnabled && (
                  <small>Unpaid leave found · deductions are disabled in Workforce settings</small>
                )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
