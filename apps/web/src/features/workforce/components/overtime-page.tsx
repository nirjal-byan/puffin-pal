"use client";
import type { Permission } from "@puffinpal/permissions";
import { useCallback, useEffect, useState } from "react";
import { FormModal } from "@/components/ui/form-modal";
import { DatePicker } from "@/components/ui/date-picker";
import { Dropdown } from "@/components/ui/dropdown";
import { errorMessage, type WorkspaceApi } from "@/lib/api";
import { loadEmployees, loadOvertime } from "@/features/workforce/api";
import type { EmployeeOption, OvertimeRequest } from "@/features/workforce/types";
import { employeeName, shortDate } from "@/features/workforce/types";
import { MetricCard, StatusBadge, WorkforceEmpty } from "@/features/workforce/workforce-ui";

export default function OvertimePage({
  api,
  permissions,
  onSaved,
}: {
  api: WorkspaceApi;
  permissions: readonly Permission[];
  onSaved: (message: string) => void;
}) {
  const [requests, setRequests] = useState<OvertimeRequest[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    employeeId: "",
    workDate: "",
    requestedMinutes: 60,
    reason: "",
    hourlyRate: "",
    multiplier: "",
  });
  const can = (permission: Permission) => permissions.includes(permission);
  const refresh = useCallback(async () => {
    const [items, people] = await Promise.all([loadOvertime(api), loadEmployees(api)]);
    setRequests(items);
    setEmployees(people);
  }, [api]);
  useEffect(() => {
    let active = true;
    Promise.all([loadOvertime(api), loadEmployees(api)])
      .then(([items, people]) => {
        if (!active) return;
        setRequests(items);
        setEmployees(people);
      })
      .catch((failure) => {
        if (active) setError(errorMessage(failure));
      });
    return () => {
      active = false;
    };
  }, [api]);
  async function create() {
    setError("");
    try {
      const body = {
        ...form,
        ...(form.hourlyRate ? {} : { hourlyRate: undefined }),
        ...(form.multiplier ? {} : { multiplier: undefined }),
      };
      const created = await api<OvertimeRequest>(
        can("overtime:manage") ? "/overtime/manage" : "/overtime",
        { method: "POST", body },
      );
      await api(`/overtime/${created.id}/submit`, {
        method: "POST",
        body: { expectedVersion: created.version },
      });
      setOpen(false);
      await refresh();
      onSaved("Overtime request submitted.");
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }
  async function review(request: OvertimeRequest, action: "approve" | "reject") {
    setError("");
    try {
      await api(`/overtime/${request.id}/${action}`, {
        method: "POST",
        body: {
          expectedVersion: request.version,
          ...(action === "approve"
            ? { approvedMinutes: request.requestedMinutes }
            : { reason: "Not approved" }),
        },
      });
      await refresh();
      onSaved(`Overtime ${action}d.`);
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }
  const approvedMinutes = requests.reduce(
    (sum, request) => sum + (request.status === "APPROVED" ? (request.approvedMinutes ?? 0) : 0),
    0,
  );
  return (
    <>
      {error && (
        <div className="alert" role="alert">
          {error}
        </div>
      )}
      <section className="workforce-metrics" data-tour="overtime-overview">
        <MetricCard
          label="Pending"
          value={requests.filter((request) => request.status === "PENDING_APPROVAL").length}
          detail="Awaiting review"
        />
        <MetricCard
          label="Approved hours"
          value={(approvedMinutes / 60).toFixed(1)}
          detail="Approved duration"
        />
        <MetricCard
          label="Employees"
          value={new Set(requests.map((request) => request.employeeId)).size}
          detail="With overtime records"
        />
        <MetricCard label="Total requests" value={requests.length} detail="Request history" />
      </section>
      <section className="panel workforce-toolbar">
        <div>
          <h3>Overtime requests</h3>
          <p className="muted">Worked time stays separate from approved payable overtime.</p>
        </div>
        {can("overtime:request") && (
          <button
            className="button primary"
            data-tour="overtime-request"
            onClick={() => setOpen(true)}
          >
            + Request overtime
          </button>
        )}
      </section>
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
                      {request.status === "PENDING_APPROVAL" && can("overtime:approve") && (
                        <div className="row-actions">
                          <button
                            className="text-button"
                            onClick={() => review(request, "approve")}
                          >
                            Approve
                          </button>
                          <button
                            className="text-button danger-text"
                            onClick={() => review(request, "reject")}
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
      {open && (
        <FormModal title="Request overtime" badge="Overtime" onClose={() => setOpen(false)}>
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
                  onChange={(employeeId) => setForm({ ...form, employeeId })}
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
                    onChange={(workDate) => setForm({ ...form, workDate })}
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
                      setForm({ ...form, requestedMinutes: Number(event.target.value) })
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
                  onChange={(event) => setForm({ ...form, reason: event.target.value })}
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
                    onChange={(event) => setForm({ ...form, hourlyRate: event.target.value })}
                  />
                </label>
                <label>
                  Multiplier <small>optional</small>
                  <input
                    inputMode="decimal"
                    placeholder="For example, 1.5"
                    value={form.multiplier}
                    onChange={(event) => setForm({ ...form, multiplier: event.target.value })}
                  />
                </label>
              </div>
            </section>
            <div className="workforce-form-actions">
              <button className="button secondary" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button
                className="button primary"
                disabled={!form.employeeId || !form.workDate || !form.reason}
                onClick={create}
              >
                Submit request
              </button>
            </div>
          </div>
        </FormModal>
      )}
    </>
  );
}
