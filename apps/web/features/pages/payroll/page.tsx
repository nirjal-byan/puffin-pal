"use client";

import type { Permission } from "@puffinpal/permissions";
import { useCallback, useEffect, useState } from "react";
import { AppModal } from "../../../components/app-modal";
import { DatePicker } from "../../../components/date-picker";
import { FormModal } from "../../../components/form-modal";
import { errorMessage, type WorkspaceApi } from "../../../lib/api";
import { PayrollAutomation } from "./payroll-automation";
import { PayrollStatutory } from "./payroll-statutory";

type PayrollRun = {
  id: string;
  name: string;
  periodStart: string;
  periodEnd: string;
  paymentDate: string;
  status: "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "FINALIZED";
  currency: string;
  totalGross: string;
  totalDeductions: string;
  totalNet: string;
  employeeCount: number;
  version: number;
  payrollScheduleId?: string | null;
};
type PayrollEntry = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  jobTitle: string;
  grossPay: string;
  totalDeductions: string;
  netPay: string;
  paidAmount: string;
  outstandingAmount: string;
  paymentStatus: string;
  payslipStatus: string;
  payments: Array<{ id: string; amount: string; paymentDate: string; reference: string }>;
};
type PayrollDetails = PayrollRun & { entries: PayrollEntry[] };
type WorkforceReview = {
  employeeId: string;
  employeeName: string;
  recordedAttendanceDays: number;
  workedMinutes: number;
  scheduledWorkdays: number;
  missingAttendanceRecords: number;
  approvedPaidLeaveUnits: number;
  approvedUnpaidLeaveUnits: number;
  unresolvedLeaveRequests: number;
  unresolvedOvertimeRequests: number;
  approvedOvertime: Array<{ id: string; minutes?: number; rate?: string; imported: boolean }>;
  unpaidLeaveDeductionsEnabled: boolean;
  approvedUnpaidLeave: Array<{
    id: string;
    startDate: string;
    endDate: string;
    minutes?: number;
    imported: boolean;
  }>;
};
type EmployeeOption = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  status: string;
};

function initialDates() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  return {
    periodStart: iso(new Date(Date.UTC(year, month, 1))),
    periodEnd: iso(new Date(Date.UTC(year, month + 1, 0))),
    paymentDate: iso(new Date(Date.UTC(year, month + 1, 1))),
  };
}

export default function PayrollPage({
  api,
  permissions,
  onSaved,
}: {
  api: WorkspaceApi;
  permissions: readonly Permission[];
  onSaved: (message: string) => void;
}) {
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [selected, setSelected] = useState<PayrollDetails | null>(null);
  const [workforceReview, setWorkforceReview] = useState<WorkforceReview[]>([]);
  const [creating, setCreating] = useState(false);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [employeeIds, setEmployeeIds] = useState<string[]>([]);
  const [form, setForm] = useState(() => ({ name: "", ...initialDates() }));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const can = (permission: Permission) => permissions.includes(permission);
  const load = useCallback(async () => {
    const data = await api<{ items: PayrollRun[] }>("/payroll/runs?limit=100&offset=0");
    setRuns(data.items);
  }, [api]);
  useEffect(() => {
    let active = true;
    api<{ items: PayrollRun[] }>("/payroll/runs?limit=100&offset=0")
      .then((data) => {
        if (active) setRuns(data.items);
      })
      .catch((failure: unknown) => {
        if (active) setError(errorMessage(failure));
      });
    return () => {
      active = false;
    };
  }, [api]);
  useEffect(() => {
    if (!creating) return;
    let active = true;
    api<{ items: EmployeeOption[] }>("/employees?limit=100&offset=0")
      .then((data) => {
        if (!active) return;
        const eligible = data.items.filter((employee) =>
          ["ACTIVE", "ON_LEAVE"].includes(employee.status),
        );
        setEmployees(eligible);
        setEmployeeIds(eligible.map((employee) => employee.id));
      })
      .catch((failure: unknown) => {
        if (active) setError(errorMessage(failure));
      });
    return () => {
      active = false;
    };
  }, [api, creating]);
  async function open(run: PayrollRun) {
    try {
      const [details, review] = await Promise.all([
        api<PayrollDetails>(`/payroll/runs/${run.id}`),
        api<WorkforceReview[]>(`/payroll/runs/${run.id}/workforce-review`),
      ]);
      setSelected(details);
      setWorkforceReview(review);
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }
  async function importOvertime(entry: PayrollEntry, overtimeId: string) {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      const updated = await api<PayrollRun>(
        `/payroll/runs/${selected.id}/entries/${entry.id}/overtime`,
        {
          method: "POST",
          body: { expectedVersion: selected.version, overtimeRequestId: overtimeId },
        },
      );
      await open(updated);
      onSaved("Approved overtime imported.");
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  async function importUnpaidLeave(entry: PayrollEntry, leaveRequestId: string) {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      const updated = await api<PayrollRun>(
        `/payroll/runs/${selected.id}/entries/${entry.id}/unpaid-leave`,
        {
          method: "POST",
          body: { expectedVersion: selected.version, leaveRequestId },
        },
      );
      await open(updated);
      onSaved("Unpaid-leave deduction imported for review.");
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  async function create() {
    setBusy(true);
    setError("");
    try {
      const run = await api<PayrollRun>("/payroll/runs", { method: "POST", body: form });
      const calculated = await api<PayrollRun>(`/payroll/runs/${run.id}/calculate`, {
        method: "POST",
        body: { expectedVersion: run.version, employeeIds },
      });
      setCreating(false);
      await load();
      await open(calculated);
      onSaved("Payroll draft created and calculated.");
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  async function action(name: "calculate" | "submit" | "approve" | "finalize") {
    if (!selected) return;
    if (
      name !== "calculate" &&
      !window.confirm(
        name === "finalize"
          ? "Finalize this payroll? Calculations cannot be changed afterward."
          : `${name === "submit" ? "Submit" : "Approve"} this payroll?`,
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await api(`/payroll/runs/${selected.id}/${name}`, {
        method: "POST",
        body: {
          expectedVersion: selected.version,
          ...(name === "calculate"
            ? { employeeIds: selected.entries.map((entry) => entry.employeeId) }
            : {}),
        },
      });
      await load();
      await open(selected);
      onSaved(`Payroll ${name}d.`);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  async function reject() {
    if (!selected) return;
    const reason = window.prompt("Why is this payroll being returned to draft?");
    if (!reason) return;
    setBusy(true);
    try {
      await api(`/payroll/runs/${selected.id}/reject`, {
        method: "POST",
        body: { expectedVersion: selected.version, reason },
      });
      await load();
      await open(selected);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  async function payment(entry: PayrollEntry) {
    if (!selected) return;
    const amount = window.prompt("Payment amount", entry.outstandingAmount);
    if (!amount) return;
    const reference = window.prompt("Payment reference");
    if (!reference) return;
    setBusy(true);
    try {
      await api(`/payroll/runs/${selected.id}/entries/${entry.id}/payments`, {
        method: "POST",
        body: {
          amount,
          reference,
          paymentDate: new Date().toISOString().slice(0, 10),
          idempotencyKey: crypto.randomUUID(),
        },
      });
      await open(selected);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  async function adjustment(entry: PayrollEntry) {
    if (!selected) return;
    const type = window.prompt("Adjustment type: EARNING or DEDUCTION", "EARNING")?.toUpperCase();
    if (type !== "EARNING" && type !== "DEDUCTION") return;
    const name = window.prompt("Adjustment description");
    const amount = window.prompt("Adjustment amount");
    if (!name || !amount) return;
    setBusy(true);
    try {
      await api(`/payroll/runs/${selected.id}/entries/${entry.id}/adjustments`, {
        method: "POST",
        body: { expectedVersion: selected.version, type, name, amount },
      });
      await load();
      await open(selected);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  async function download(entry: PayrollEntry) {
    if (!selected) return;
    try {
      const blob = await api<Blob>(`/payroll/runs/${selected.id}/entries/${entry.id}/payslip`, {
        responseType: "file",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `payslip-${entry.employeeCode}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }
  async function retryPayslip(entry: PayrollEntry) {
    if (!selected) return;
    setBusy(true);
    try {
      await api(`/payroll/runs/${selected.id}/entries/${entry.id}/payslip/retry`, {
        method: "POST",
      });
      await open(selected);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className="panel payroll-toolbar" data-tour="payroll-overview">
        <div>
          <h3>Pay runs</h3>
          <p className="muted">Review totals before approval and finalization.</p>
        </div>
        {can("payroll:create") && (
          <button className="button primary" onClick={() => setCreating(true)}>
            + New pay run
          </button>
        )}
      </section>
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      <PayrollAutomation
        api={api}
        permissions={permissions}
        onSaved={onSaved}
        onRunsChanged={load}
      />
      {can("payroll:manage") && <PayrollStatutory api={api} />}
      <section className="panel">
        <div className="panel-heading">
          <h3>Payroll history</h3>
          <span className="muted">{runs.length} total</span>
        </div>
        {runs.length === 0 ? (
          <div className="empty-state">
            <span className="empty-symbol">$</span>
            <h3>No pay runs yet</h3>
            <p>Create a draft when your team’s salary structures are ready.</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Run</th>
                  <th>Period</th>
                  <th>Employees</th>
                  <th>Net payroll</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id}>
                    <td>
                      <strong>{run.name}</strong>
                      {run.payrollScheduleId && (
                        <small className="payroll-subtitle muted">Automated draft</small>
                      )}
                    </td>
                    <td>
                      {run.periodStart.slice(0, 10)} – {run.periodEnd.slice(0, 10)}
                    </td>
                    <td>{run.employeeCount}</td>
                    <td>
                      {run.currency} {run.totalNet}
                    </td>
                    <td>
                      <span className="role-badge">{run.status.replaceAll("_", " ")}</span>
                    </td>
                    <td>
                      <button className="text-button" onClick={() => void open(run)}>
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {creating && (
        <FormModal title="New pay run" onClose={() => setCreating(false)}>
          <div className="payroll-form">
            <label>
              Name
              <input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="October payroll"
              />
            </label>
            <div className="payroll-date-grid">
              <label>
                Period start
                <DatePicker
                  value={form.periodStart}
                  onChange={(periodStart) => setForm({ ...form, periodStart })}
                  ariaLabel="Payroll period start"
                />
              </label>
              <label>
                Period end
                <DatePicker
                  value={form.periodEnd}
                  onChange={(periodEnd) => setForm({ ...form, periodEnd })}
                  min={form.periodStart || undefined}
                  ariaLabel="Payroll period end"
                />
              </label>
            </div>
            <label>
              Payment date
              <DatePicker
                value={form.paymentDate}
                onChange={(paymentDate) => setForm({ ...form, paymentDate })}
                min={form.periodEnd || undefined}
                ariaLabel="Payroll payment date"
              />
            </label>
            <fieldset className="payroll-employees">
              <legend>Employees</legend>
              {employees.length === 0 ? (
                <p className="muted">No eligible employees found.</p>
              ) : (
                employees.map((employee) => (
                  <label key={employee.id}>
                    <input
                      type="checkbox"
                      checked={employeeIds.includes(employee.id)}
                      onChange={(event) =>
                        setEmployeeIds((current) =>
                          event.target.checked
                            ? [...current, employee.id]
                            : current.filter((id) => id !== employee.id),
                        )
                      }
                    />
                    <span>
                      {employee.firstName} {employee.lastName}{" "}
                      <small className="muted">{employee.employeeCode}</small>
                    </span>
                  </label>
                ))
              )}
            </fieldset>
            <div className="form-actions">
              <button className="button secondary" onClick={() => setCreating(false)}>
                Cancel
              </button>
              <button
                className="button primary"
                disabled={busy || !form.name.trim() || employeeIds.length === 0}
                onClick={() => void create()}
              >
                Create draft
              </button>
            </div>
          </div>
        </FormModal>
      )}
      {selected && (
        <AppModal
          wide
          title={selected.name}
          badge={selected.status.replaceAll("_", " ")}
          onClose={() => setSelected(null)}
        >
          <div className="payroll-detail">
            <div className="payroll-summary">
              <div>
                <small>Gross</small>
                <strong>
                  {selected.currency} {selected.totalGross}
                </strong>
              </div>
              <div>
                <small>Deductions</small>
                <strong>
                  {selected.currency} {selected.totalDeductions}
                </strong>
              </div>
              <div>
                <small>Net pay</small>
                <strong>
                  {selected.currency} {selected.totalNet}
                </strong>
              </div>
            </div>
            <div className="form-actions payroll-actions">
              {selected.status === "DRAFT" && can("payroll:manage") && (
                <>
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() => void action("calculate")}
                  >
                    Calculate
                  </button>
                  <button
                    className="button primary"
                    disabled={busy || selected.employeeCount < 1}
                    onClick={() => void action("submit")}
                  >
                    Submit for approval
                  </button>
                </>
              )}
              {selected.status === "PENDING_APPROVAL" && can("payroll:approve") && (
                <>
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() => void reject()}
                  >
                    Return to draft
                  </button>
                  <button
                    className="button primary"
                    disabled={busy}
                    onClick={() => void action("approve")}
                  >
                    Approve
                  </button>
                </>
              )}
              {selected.status === "APPROVED" && can("payroll:finalize") && (
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() => void action("finalize")}
                >
                  Finalize payroll
                </button>
              )}
            </div>
            {can("payroll:manage") && selected.status === "DRAFT" && (
              <PayrollStatutory
                api={api}
                run={selected}
                onApplied={async () => {
                  await open(selected);
                }}
              />
            )}
            <section className="payroll-workforce-review" data-tour="payroll-attendance-review">
              <div className="panel-heading">
                <h3>Attendance review</h3>
                <span className="muted">Review only · no automatic deductions</span>
              </div>
              <div className="payroll-review-grid">
                {workforceReview.map((review) => {
                  const entry = selected.entries.find(
                    (item) => item.employeeId === review.employeeId,
                  );
                  return (
                    <article key={review.employeeId}>
                      <strong>{review.employeeName}</strong>
                      <span>
                        {review.recordedAttendanceDays} attendance days ·{" "}
                        {(review.workedMinutes / 60).toFixed(1)} hours
                      </span>
                      <span>{review.missingAttendanceRecords} missing records · warning only</span>
                      <span>
                        {review.approvedPaidLeaveUnits / 2} paid ·{" "}
                        {review.approvedUnpaidLeaveUnits / 2} unpaid leave days
                      </span>
                      {(review.unresolvedLeaveRequests > 0 ||
                        review.unresolvedOvertimeRequests > 0) && (
                        <small>
                          {review.unresolvedLeaveRequests} leave and{" "}
                          {review.unresolvedOvertimeRequests} overtime requests unresolved
                        </small>
                      )}
                      {selected.status === "DRAFT" &&
                        entry &&
                        review.approvedOvertime
                          .filter((item) => !item.imported)
                          .map((item) => (
                            <button
                              key={item.id}
                              className="text-button"
                              disabled={busy || !item.rate}
                              onClick={() => void importOvertime(entry, item.id)}
                            >
                              {item.rate
                                ? `Import ${item.minutes ?? 0} overtime minutes`
                                : "Overtime rate required"}
                            </button>
                          ))}
                      {selected.status === "DRAFT" &&
                        entry &&
                        review.unpaidLeaveDeductionsEnabled &&
                        review.approvedUnpaidLeave
                          .filter((item) => !item.imported)
                          .map((item) => (
                            <button
                              key={item.id}
                              className="text-button"
                              disabled={busy}
                              onClick={() => void importUnpaidLeave(entry, item.id)}
                            >
                              Import {(item.minutes ?? 0) / 60} unpaid leave hours
                            </button>
                          ))}
                      {review.approvedUnpaidLeave.some((item) => !item.imported) &&
                        !review.unpaidLeaveDeductionsEnabled && (
                          <small>
                            Unpaid leave found · deductions are disabled in Workforce settings
                          </small>
                        )}
                    </article>
                  );
                })}
              </div>
            </section>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Gross</th>
                    <th>Deductions</th>
                    <th>Net</th>
                    <th>Payment</th>
                    <th>Payslip</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.entries.map((entry) => (
                    <tr key={entry.id}>
                      <td>
                        <strong>{entry.employeeName}</strong>
                        <small className="muted payroll-subtitle">
                          {entry.employeeCode} · {entry.jobTitle}
                        </small>
                        {selected.status === "DRAFT" && can("payroll:manage") && (
                          <button
                            className="text-button"
                            disabled={busy}
                            onClick={() => void adjustment(entry)}
                          >
                            + Adjustment
                          </button>
                        )}
                      </td>
                      <td>{entry.grossPay}</td>
                      <td>{entry.totalDeductions}</td>
                      <td>{entry.netPay}</td>
                      <td>
                        {entry.paymentStatus}
                        {entry.payments.map((payment) => (
                          <small className="muted payroll-subtitle" key={payment.id}>
                            {payment.paymentDate.slice(0, 10)} · {selected.currency}{" "}
                            {payment.amount} · {payment.reference}
                          </small>
                        ))}
                        {selected.status === "FINALIZED" &&
                          entry.outstandingAmount !== "0.00" &&
                          can("payroll:payments:record") && (
                            <button className="text-button" onClick={() => void payment(entry)}>
                              Record
                            </button>
                          )}
                      </td>
                      <td>
                        {entry.payslipStatus === "COMPLETED" ? (
                          <button className="text-button" onClick={() => void download(entry)}>
                            Download
                          </button>
                        ) : entry.payslipStatus === "FAILED" && can("payroll:manage") ? (
                          <button
                            className="text-button"
                            disabled={busy}
                            onClick={() => void retryPayslip(entry)}
                          >
                            Retry
                          </button>
                        ) : (
                          entry.payslipStatus
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </AppModal>
      )}
    </>
  );
}
