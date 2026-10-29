import type { EmployeeOption, LeaveBalance, LeaveRequest, LeaveType } from "../types";
import { employeeName, shortDate } from "../types";
import { StatusBadge, WorkforceEmpty } from "./workforce-ui";

export function LeaveBalances({
  balances,
  employees,
}: {
  balances: LeaveBalance[];
  employees: EmployeeOption[];
}) {
  if (!balances.length) return null;
  return (
    <section className="panel leave-balance-strip" data-tour="leave-balances">
      <div className="panel-heading">
        <h3>Leave balances</h3>
        <span className="muted">Exact balances in hours and minutes</span>
      </div>
      <div className="balance-grid">
        {balances.slice(0, 8).map((balance) => (
          <article key={`${balance.employeeId}-${balance.leaveTypeId}`}>
            <strong>{employeeName(employees, balance.employeeId)}</strong>
            <span>{balance.leaveTypeName}</span>
            <b>{(balance.availableMinutes / 60).toFixed(1)} hours available</b>
            <small className="muted">
              {(balance.usedMinutes / 60).toFixed(1)} used ·{" "}
              {(balance.pendingMinutes / 60).toFixed(1)} pending
            </small>
          </article>
        ))}
      </div>
    </section>
  );
}
export function LeaveRequestsTable({
  requests,
  types,
  employees,
  canApprove,
  onReview,
}: {
  requests: LeaveRequest[];
  types: LeaveType[];
  employees: EmployeeOption[];
  canApprove: boolean;
  onReview: (request: LeaveRequest, action: "approve" | "reject") => void;
}) {
  return (
    <section className="panel" data-tour="leave-approvals">
      <div className="panel-heading">
        <h3>Requests</h3>
        <span className="muted">{requests.length} total</span>
      </div>
      {!requests.length ? (
        <WorkforceEmpty
          title="No leave requests"
          detail="Submitted requests and approval history will appear here."
        />
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Type</th>
                <th>Dates</th>
                <th>Days</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id}>
                  <td>{employeeName(employees, request.employeeId)}</td>
                  <td>{types.find((type) => type.id === request.leaveTypeId)?.name ?? "Leave"}</td>
                  <td>
                    {shortDate(request.startDate)} – {shortDate(request.endDate)}
                  </td>
                  <td>{request.requestedUnits / 2}</td>
                  <td>
                    <StatusBadge status={request.status} />
                  </td>
                  <td>
                    {request.status === "PENDING_APPROVAL" && canApprove && (
                      <div className="row-actions">
                        <button
                          className="text-button"
                          onClick={() => onReview(request, "approve")}
                        >
                          Approve
                        </button>
                        <button
                          className="text-button danger-text"
                          onClick={() => onReview(request, "reject")}
                        >
                          Reject
                        </button>
                      </div>
                    )}
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
