"use client";
import { useCallback, useEffect, useState } from "react";
import { errorMessage, type WorkspaceApi } from "@/lib/api";
import type { EmployeeOption, LeaveType } from "../types";
import {
  BalanceAdjustmentDialog,
  LeavePolicyDialog,
  type BalanceAdjustmentForm,
  type LeavePolicy,
  type LeavePolicyForm,
} from "./leave-policy-components";
import { LeavePolicyTable } from "./leave-policy-table";

const today = () => new Date().toISOString().slice(0, 10);
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
  const [policies, setPolicies] = useState<LeavePolicy[]>([]);
  const [open, setOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<LeavePolicyForm>({
    leaveTypeId: "",
    name: "",
    frequency: "ANNUAL",
    entitlementMinutes: 9600,
    effectiveFrom: today(),
    prorateNewJoiners: true,
    carryForwardMode: "NONE",
    carryForwardCapMinutes: undefined,
    expiresAfterMonths: undefined,
    isActive: true,
  });
  const [adjustment, setAdjustment] = useState<BalanceAdjustmentForm>({
    employeeId: "",
    leaveTypeId: "",
    hours: 0,
    effectiveDate: today(),
    reason: "",
  });
  const load = useCallback(() => api<LeavePolicy[]>("/leave/policies").then(setPolicies), [api]);
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
        body: { asOfDate: today(), policyId, preview: true },
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
        body: { asOfDate: today(), policyId, preview: false },
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
        <LeavePolicyTable
          policies={policies}
          types={types}
          onPreview={(id) => void preview(id)}
          onProcess={(id) => void process(id)}
        />
      </section>
      {open && (
        <LeavePolicyDialog
          form={form}
          types={types}
          onChange={setForm}
          onClose={() => setOpen(false)}
          onSubmit={save}
        />
      )}{" "}
      {adjustOpen && (
        <BalanceAdjustmentDialog
          form={adjustment}
          employees={employees}
          types={types}
          onChange={setAdjustment}
          onClose={() => setAdjustOpen(false)}
          onSubmit={adjustBalance}
        />
      )}
    </>
  );
}
