import { DatePicker } from "@/components/ui/date-picker";
import { Dropdown } from "@/components/ui/dropdown";
import { FormModal } from "@/components/ui/form-modal";
import type { EmployeeOption, OvertimeRequest } from "../types";
import { employeeName, shortDate } from "../types";
import { StatusBadge, WorkforceEmpty } from "../workforce-ui";

export type OvertimeForm = {
  employeeId: string;
  workDate: string;
  requestedMinutes: number;
  reason: string;
  hourlyRate: string;
  multiplier: string;
};
export function OvertimeRequestsTable({
  requests,
  employees,
  canApprove,
  onReview,
}: {
  requests: OvertimeRequest[];
  employees: EmployeeOption[];
  canApprove: boolean;
  onReview: (request: OvertimeRequest, action: "approve" | "reject") => void;
}) {
  return (
    <section className="panel" data-tour="overtime-approvals">
      <div className="panel-heading">
        <h3>Overtime history</h3>
        <span className="muted">{requests.length} total</span>
      </div>
      {!requests.length ? (
        <WorkforceEmpty
          title="No overtime requests"
          detail="Submitted and approved overtime will appear here."
        />
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Work date</th>
                <th>Requested</th>
                <th>Approved</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id}>
                  <td>
                    {employeeName(employees, request.employeeId)}
                    <small className="muted workforce-row-detail">{request.reason}</small>
                  </td>
                  <td>{shortDate(request.workDate)}</td>
                  <td>{request.requestedMinutes} min</td>
                  <td>{request.approvedMinutes ? `${request.approvedMinutes} min` : "—"}</td>
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
export function OvertimeRequestDialog({
  form,
  employees,
  onChange,
  onClose,
  onSubmit,
}: {
  form: OvertimeForm;
  employees: EmployeeOption[];
  onChange: (form: OvertimeForm) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <FormModal title="Request overtime" badge="Overtime" onClose={onClose}>
      <div className="workforce-form">
        <div className="workforce-form-intro">
          <span className="workforce-form-icon" aria-hidden="true">
            ◷
          </span>
          <div>
            <strong>Log additional time</strong>
            <p>Record the work performed and optional compensation details.</p>
          </div>
        </div>
        <section className="workforce-form-section">
          <div className="workforce-form-section-heading">
            <span>Request details</span>
            <small>Work information</small>
          </div>
          <label>
            Employee
            <Dropdown
              name="overtime-employee"
              label="Employee"
              placeholder="Select employee"
              value={form.employeeId}
              onChange={(employeeId) => onChange({ ...form, employeeId })}
              options={employees.map((employee) => ({
                value: employee.id,
                label: `${employee.firstName} ${employee.lastName}`,
              }))}
            />
          </label>
          <div className="workforce-form-grid">
            <label>
              Work date
              <DatePicker
                value={form.workDate}
                onChange={(workDate) => onChange({ ...form, workDate })}
                ariaLabel="Overtime work date"
              />
            </label>
            <label>
              Minutes
              <input
                type="number"
                min="1"
                max="1440"
                value={form.requestedMinutes}
                onChange={(event) =>
                  onChange({ ...form, requestedMinutes: Number(event.target.value) })
                }
              />
            </label>
          </div>
          <label>
            Reason
            <textarea
              rows={3}
              placeholder="Describe the additional work"
              value={form.reason}
              onChange={(event) => onChange({ ...form, reason: event.target.value })}
            />
          </label>
        </section>
        <section className="workforce-form-section workforce-form-section-muted">
          <div className="workforce-form-section-heading">
            <span>Compensation</span>
            <small>Optional</small>
          </div>
          <div className="workforce-form-grid">
            <label>
              Hourly rate <small>optional</small>
              <input
                inputMode="decimal"
                placeholder="Use salary rate"
                value={form.hourlyRate}
                onChange={(event) => onChange({ ...form, hourlyRate: event.target.value })}
              />
            </label>
            <label>
              Multiplier <small>optional</small>
              <input
                inputMode="decimal"
                placeholder="For example, 1.5"
                value={form.multiplier}
                onChange={(event) => onChange({ ...form, multiplier: event.target.value })}
              />
            </label>
          </div>
        </section>
        <div className="workforce-form-actions">
          <button className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="button primary"
            disabled={!form.employeeId || !form.workDate || !form.reason}
            onClick={onSubmit}
          >
            Submit request
          </button>
        </div>
      </div>
    </FormModal>
  );
}
