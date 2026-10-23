"use client";
import type { Permission } from "@puffinpal/permissions";
import { useCallback, useEffect, useState } from "react";
import { FormModal } from "../../../components/form-modal";
import { DatePicker } from "../../../components/date-picker";
import { Dropdown } from "../../../components/dropdown";
import { errorMessage, type WorkspaceApi } from "../../../lib/api";
import { loadEmployees, loadLeave } from "../../workforce/api";
import type { EmployeeOption, LeaveBalance, LeaveRequest, LeaveType } from "../../workforce/types";
import { employeeName, shortDate } from "../../workforce/types";
import { MetricCard, StatusBadge, WorkforceEmpty } from "../../workforce/workforce-ui";
import { LeavePolicyManagement } from "./leave-policy-management";

export default function LeavePage({
  api,
  permissions,
  onSaved,
}: {
  api: WorkspaceApi;
  permissions: readonly Permission[];
  onSaved: (message: string) => void;
}) {
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<"request" | "type" | null>(null);
  const [form, setForm] = useState({
    employeeId: "",
    leaveTypeId: "",
    startDate: "",
    endDate: "",
    dayPortion: "FULL_DAY",
    reason: "",
  });
  const [typeForm, setTypeForm] = useState({
    name: "",
    code: "",
    isPaid: true,
    requiresApproval: true,
    annualAllowanceUnits: 20,
  });
  const can = (permission: Permission) => permissions.includes(permission);
  const refresh = useCallback(async () => {
    const [[leaveTypes, leaveRequests, leaveBalances], people] = await Promise.all([
      loadLeave(api),
      loadEmployees(api),
    ]);
    setTypes(leaveTypes);
    setRequests(leaveRequests);
    setBalances(leaveBalances);
    setEmployees(people);
  }, [api]);
  useEffect(() => {
    let active = true;
    Promise.all([loadLeave(api), loadEmployees(api)])
      .then(([[leaveTypes, leaveRequests, leaveBalances], people]) => {
        if (!active) return;
        setTypes(leaveTypes);
        setRequests(leaveRequests);
        setBalances(leaveBalances);
        setEmployees(people);
      })
      .catch((failure) => {
        if (active) setError(errorMessage(failure));
      });
    return () => {
      active = false;
    };
  }, [api]);
  async function createRequest() {
    setError("");
    try {
      const created = await api<LeaveRequest>(
        can("leave:manage") ? "/leave/requests/manage" : "/leave/requests",
        { method: "POST", body: form },
      );
      await api(`/leave/requests/${created.id}/submit`, {
        method: "POST",
        body: { expectedVersion: created.version },
      });
      setOpen(null);
      await refresh();
      onSaved("Leave request submitted.");
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }
  async function createType() {
    setError("");
    try {
      await api("/leave/types", { method: "POST", body: typeForm });
      setOpen(null);
      await refresh();
      onSaved("Leave type created.");
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }
  async function review(request: LeaveRequest, action: "approve" | "reject") {
    setError("");
    try {
      await api(`/leave/requests/${request.id}/${action}`, {
        method: "POST",
        body: {
          expectedVersion: request.version,
          ...(action === "reject" ? { reason: "Not approved" } : {}),
        },
      });
      await refresh();
      onSaved(`Leave ${action}d.`);
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }
  const pending = requests.filter((request) => request.status === "PENDING_APPROVAL").length;
  return (
    <>
      {error && (
        <div className="alert" role="alert">
          {error}
        </div>
      )}
      <section className="workforce-metrics" data-tour="leave-overview">
        <MetricCard label="Pending" value={pending} detail="Awaiting review" />
        <MetricCard
          label="Approved"
          value={requests.filter((request) => request.status === "APPROVED").length}
          detail="Current history"
        />
        <MetricCard
          label="Upcoming"
          value={
            requests.filter(
              (request) =>
                request.status === "APPROVED" &&
                shortDate(request.startDate) >= new Date().toISOString().slice(0, 10),
            ).length
          }
          detail="Approved future leave"
        />
        <MetricCard
          label="Leave types"
          value={types.filter((type) => type.isActive).length}
          detail="Active policies"
        />
      </section>
      <section className="panel workforce-toolbar">
        <div>
          <h3>Leave management</h3>
          <p className="muted">Workday-aware requests and auditable balances.</p>
        </div>
        <div className="row-actions">
          {can("leave:manage") && (
            <button className="button secondary" onClick={() => setOpen("type")}>
              Leave types
            </button>
          )}
          {can("leave:request") && (
            <button
              className="button primary"
              data-tour="leave-request"
              onClick={() => setOpen("request")}
            >
              + Request leave
            </button>
          )}
        </div>
      </section>
      {balances.length > 0 && (
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
      )}
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
                    <td>
                      {types.find((type) => type.id === request.leaveTypeId)?.name ?? "Leave"}
                    </td>
                    <td>
                      {shortDate(request.startDate)} – {shortDate(request.endDate)}
                    </td>
                    <td>{request.requestedUnits / 2}</td>
                    <td>
                      <StatusBadge status={request.status} />
                    </td>
                    <td>
                      {request.status === "PENDING_APPROVAL" && can("leave:approve") && (
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
      {can("leave:manage") && (
        <LeavePolicyManagement api={api} types={types} employees={employees} onSaved={onSaved} />
      )}
      {open === "request" && (
        <FormModal title="Request leave" badge="Time off" onClose={() => setOpen(null)}>
          <div className="workforce-form">
            <div className="workforce-form-intro">
              <span className="workforce-form-icon" aria-hidden="true">
                ↗
              </span>
              <div>
                <strong>Plan time away</strong>
                <p>Select the policy and dates for this request.</p>
              </div>
            </div>
            <section className="workforce-form-section">
              <div className="workforce-form-section-heading">
                <span>Request details</span>
                <small>All fields except reason are required</small>
              </div>
              <div className="workforce-form-grid">
                <label>
                  Employee
                  <Dropdown
                    name="leave-employee"
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
                  Leave type
                  <Dropdown
                    name="leave-type"
                    label="Leave type"
                    placeholder="Select type"
                    value={form.leaveTypeId}
                    onChange={(leaveTypeId) => setForm({ ...form, leaveTypeId })}
                    options={types
                      .filter((type) => type.isActive)
                      .map((type) => ({ value: type.id, label: type.name }))}
                  />
                </label>
                <label>
                  Start date
                  <DatePicker
                    value={form.startDate}
                    onChange={(startDate) => setForm({ ...form, startDate })}
                    ariaLabel="Leave start date"
                  />
                </label>
                <label>
                  End date
                  <DatePicker
                    value={form.endDate}
                    onChange={(endDate) => setForm({ ...form, endDate })}
                    min={form.startDate || undefined}
                    ariaLabel="Leave end date"
                  />
                </label>
                <label>
                  Duration
                  <Dropdown
                    name="leave-duration"
                    label="Leave duration"
                    searchable={false}
                    value={form.dayPortion}
                    onChange={(dayPortion) => setForm({ ...form, dayPortion })}
                    options={[
                      { value: "FULL_DAY", label: "Full days" },
                      { value: "HALF_DAY", label: "Half day" },
                    ]}
                  />
                </label>
              </div>
              <label>
                Reason <small>Optional</small>
                <textarea
                  rows={3}
                  placeholder="Add a short reason for the request"
                  value={form.reason}
                  onChange={(event) => setForm({ ...form, reason: event.target.value })}
                />
              </label>
            </section>
            <div className="workforce-form-actions">
              <button className="button secondary" onClick={() => setOpen(null)}>
                Cancel
              </button>
              <button
                className="button primary"
                disabled={!form.employeeId || !form.leaveTypeId || !form.startDate || !form.endDate}
                onClick={createRequest}
              >
                Submit request
              </button>
            </div>
          </div>
        </FormModal>
      )}
      {open === "type" && (
        <FormModal title="Create leave type" badge="Policy" onClose={() => setOpen(null)}>
          <div className="workforce-form">
            <div className="workforce-form-intro">
              <span className="workforce-form-icon" aria-hidden="true">
                ＋
              </span>
              <div>
                <strong>Create a time-off policy</strong>
                <p>Define how this leave appears and how much is available each year.</p>
              </div>
            </div>
            <section className="workforce-form-section">
              <div className="workforce-form-section-heading">
                <span>Policy details</span>
                <small>Reusable across your team</small>
              </div>
              <div className="workforce-form-grid">
                <label>
                  Name
                  <input
                    placeholder="Annual leave"
                    value={typeForm.name}
                    onChange={(event) => setTypeForm({ ...typeForm, name: event.target.value })}
                  />
                </label>
                <label>
                  Code
                  <input
                    placeholder="ANNUAL"
                    value={typeForm.code}
                    onChange={(event) =>
                      setTypeForm({
                        ...typeForm,
                        code: event.target.value.toUpperCase().replaceAll(" ", "_"),
                      })
                    }
                  />
                </label>
                <label>
                  Annual allowance (half-day units)
                  <input
                    type="number"
                    min="0"
                    value={typeForm.annualAllowanceUnits}
                    onChange={(event) =>
                      setTypeForm({ ...typeForm, annualAllowanceUnits: Number(event.target.value) })
                    }
                  />
                </label>
              </div>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={typeForm.isPaid}
                  onChange={(event) => setTypeForm({ ...typeForm, isPaid: event.target.checked })}
                />{" "}
                Paid leave
              </label>
            </section>
            <div className="workforce-form-actions">
              <button className="button secondary" onClick={() => setOpen(null)}>
                Cancel
              </button>
              <button
                className="button primary"
                disabled={!typeForm.name || !typeForm.code}
                onClick={createType}
              >
                Create type
              </button>
            </div>
          </div>
        </FormModal>
      )}
    </>
  );
}
