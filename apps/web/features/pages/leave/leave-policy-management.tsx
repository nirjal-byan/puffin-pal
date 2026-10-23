"use client";

import { useCallback, useEffect, useState } from "react";
import { DatePicker } from "../../../components/date-picker";
import { Dropdown } from "../../../components/dropdown";
import { FormModal } from "../../../components/form-modal";
import { errorMessage, type WorkspaceApi } from "../../../lib/api";
import type { EmployeeOption, LeaveType } from "../../workforce/types";

type Policy = {
  id: string;
  name: string;
  leaveTypeId: string;
  frequency: string;
  entitlementMinutes: number;
  carryForwardMode: string;
  carryForwardCapMinutes?: number;
  maximumBalanceMinutes?: number;
  expiresAfterMonths?: number;
  isActive: boolean;
};

export function LeavePolicyManagement({
  api,
  types,
  employees,
  onSaved,
}: {
  api: WorkspaceApi;
  types: LeaveType[];
  employees: EmployeeOption[];
  onSaved: (message: string) => void;
}) {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [open, setOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    leaveTypeId: "",
    name: "",
    frequency: "ANNUAL",
    entitlementMinutes: 9600,
    effectiveFrom: new Date().toISOString().slice(0, 10),
    prorateNewJoiners: true,
    carryForwardMode: "NONE",
    carryForwardCapMinutes: undefined as number | undefined,
    expiresAfterMonths: undefined as number | undefined,
    isActive: true,
  });
  const [adjustment, setAdjustment] = useState({
    employeeId: "",
    leaveTypeId: "",
    hours: 0,
    effectiveDate: new Date().toISOString().slice(0, 10),
    reason: "",
  });
  const load = useCallback(() => api<Policy[]>("/leave/policies").then(setPolicies), [api]);
  useEffect(() => {
    void load().catch((failure) => setError(errorMessage(failure)));
  }, [load]);
  async function save() {
    try {
      await api("/leave/policies", { method: "POST", body: form });
      setOpen(false);
      await load();
      onSaved("Leave accrual policy created.");
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }
  async function preview(policyId: string) {
    try {
      const result = await api<{ entries: unknown[] }>("/leave/accruals/run", {
        method: "POST",
        body: { asOfDate: new Date().toISOString().slice(0, 10), policyId, preview: true },
      });
      onSaved(`${result.entries.length} accrual entries would be created. No balances changed.`);
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }
  async function process(policyId: string) {
    try {
      const result = await api<{ created: number }>("/leave/accruals/run", {
        method: "POST",
        body: { asOfDate: new Date().toISOString().slice(0, 10), policyId, preview: false },
      });
      onSaved(`${result.created} accrual entries processed. Repeating this run is safe.`);
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }
  async function adjustBalance() {
    try {
      await api("/leave/balances/adjust", {
        method: "POST",
        body: {
          employeeId: adjustment.employeeId,
          leaveTypeId: adjustment.leaveTypeId,
          minutes: Math.round(adjustment.hours * 60),
          effectiveDate: adjustment.effectiveDate,
          reason: adjustment.reason,
          idempotencyKey: `manual-${crypto.randomUUID()}`,
        },
      });
      setAdjustOpen(false);
      onSaved("Leave balance adjustment recorded in the ledger.");
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }
  return (
    <>
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h3>Accrual policies</h3>
            <p className="muted">
              Effective-dated entitlement, caps, carry-forward, and expiration.
            </p>
          </div>
          <div className="row-actions">
            <button className="button secondary" onClick={() => setAdjustOpen(true)}>
              Adjust balance
            </button>
            <button className="button secondary" onClick={() => setOpen(true)}>
              + Policy
            </button>
          </div>
        </div>
        {!policies.length ? (
          <div className="empty-state">
            <h3>No accrual policies</h3>
            <p>
              Create a policy to accrue exact leave minutes without changing historical entries.
            </p>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Policy</th>
                  <th>Frequency</th>
                  <th>Entitlement</th>
                  <th>Carry-forward</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {policies.map((policy) => (
                  <tr key={policy.id}>
                    <td>
                      <strong>{policy.name}</strong>
                      <small className="muted payroll-subtitle">
                        {types.find((type) => type.id === policy.leaveTypeId)?.name}
                      </small>
                    </td>
                    <td>{policy.frequency.replaceAll("_", " ")}</td>
                    <td>{(policy.entitlementMinutes / 60).toFixed(1)} hours/year</td>
                    <td>{policy.carryForwardMode.replaceAll("_", " ")}</td>
                    <td>{policy.isActive ? "Active" : "Inactive"}</td>
                    <td>
                      <div className="row-actions">
                        <button className="text-button" onClick={() => void preview(policy.id)}>
                          Preview
                        </button>
                        <button className="text-button" onClick={() => void process(policy.id)}>
                          Run accrual
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {open && (
        <FormModal
          title="Create accrual policy"
          badge="Leave"
          onClose={() => setOpen(false)}
          onSubmit={save}
          submitLabel="Save policy"
        >
          <div className="standard-form-grid">
            <label>
              Leave type
              <Dropdown
                name="policyLeaveType"
                label="Leave type"
                value={form.leaveTypeId}
                onChange={(leaveTypeId) => setForm({ ...form, leaveTypeId })}
                options={types.map((type) => ({ value: type.id, label: type.name }))}
              />
            </label>
            <label>
              Policy name
              <input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Annual paid leave"
              />
            </label>
            <label>
              Accrual frequency
              <Dropdown
                name="policyFrequency"
                label="Accrual frequency"
                searchable={false}
                value={form.frequency}
                onChange={(frequency) => setForm({ ...form, frequency })}
                options={[
                  { value: "ANNUAL", label: "Annual entitlement" },
                  { value: "MONTHLY", label: "Monthly installments" },
                  { value: "SERVICE_MONTHLY", label: "Per completed service month" },
                ]}
              />
            </label>
            <label>
              Annual entitlement (minutes)
              <input
                type="number"
                min="1"
                value={form.entitlementMinutes}
                onChange={(event) =>
                  setForm({ ...form, entitlementMinutes: Number(event.target.value) })
                }
              />
            </label>
            <label>
              Effective from
              <DatePicker
                value={form.effectiveFrom}
                onChange={(effectiveFrom) => setForm({ ...form, effectiveFrom })}
                ariaLabel="Policy effective date"
              />
            </label>
            <label>
              Carry-forward
              <Dropdown
                name="carryForward"
                label="Carry-forward"
                searchable={false}
                value={form.carryForwardMode}
                onChange={(carryForwardMode) => setForm({ ...form, carryForwardMode })}
                options={[
                  { value: "NONE", label: "Do not carry forward" },
                  { value: "FULL", label: "Carry full balance" },
                  { value: "CAPPED", label: "Carry up to a cap" },
                ]}
              />
            </label>
            {form.carryForwardMode === "CAPPED" && (
              <label>
                Carry-forward cap (minutes)
                <input
                  type="number"
                  min="0"
                  value={form.carryForwardCapMinutes ?? ""}
                  onChange={(event) =>
                    setForm({ ...form, carryForwardCapMinutes: Number(event.target.value) })
                  }
                />
              </label>
            )}
            <label>
              Expire carried leave after months <small>Optional</small>
              <input
                type="number"
                min="1"
                max="120"
                value={form.expiresAfterMonths ?? ""}
                onChange={(event) =>
                  setForm({
                    ...form,
                    expiresAfterMonths: event.target.value ? Number(event.target.value) : undefined,
                  })
                }
              />
            </label>
          </div>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={form.prorateNewJoiners}
              onChange={(event) => setForm({ ...form, prorateNewJoiners: event.target.checked })}
            />
            <span>
              <strong>Prorate new joiners</strong>
              <small>Annual grants are reduced by the remaining months in the joining year.</small>
            </span>
          </label>
        </FormModal>
      )}
      {adjustOpen && (
        <FormModal
          title="Adjust leave balance"
          badge="Ledger"
          onClose={() => setAdjustOpen(false)}
          onSubmit={adjustBalance}
          submitLabel="Record adjustment"
        >
          <p className="muted">
            Add or subtract hours with an auditable ledger entry. Existing history is preserved.
          </p>
          <div className="standard-form-grid">
            <label>
              Employee
              <Dropdown
                name="adjustEmployee"
                label="Employee"
                value={adjustment.employeeId}
                onChange={(employeeId) => setAdjustment({ ...adjustment, employeeId })}
                options={employees.map((employee) => ({
                  value: employee.id,
                  label: `${employee.firstName} ${employee.lastName}`,
                }))}
              />
            </label>
            <label>
              Leave type
              <Dropdown
                name="adjustLeaveType"
                label="Leave type"
                value={adjustment.leaveTypeId}
                onChange={(leaveTypeId) => setAdjustment({ ...adjustment, leaveTypeId })}
                options={types.map((type) => ({ value: type.id, label: type.name }))}
              />
            </label>
            <label>
              Hours <small>Use a negative value to deduct</small>
              <input
                type="number"
                step="0.25"
                value={adjustment.hours}
                onChange={(event) =>
                  setAdjustment({ ...adjustment, hours: Number(event.target.value) })
                }
              />
            </label>
            <label>
              Effective date
              <DatePicker
                value={adjustment.effectiveDate}
                onChange={(effectiveDate) => setAdjustment({ ...adjustment, effectiveDate })}
                ariaLabel="Adjustment effective date"
              />
            </label>
          </div>
          <label>
            Reason
            <input
              value={adjustment.reason}
              onChange={(event) => setAdjustment({ ...adjustment, reason: event.target.value })}
              placeholder="Explain why this balance changed"
            />
          </label>
        </FormModal>
      )}
    </>
  );
}
