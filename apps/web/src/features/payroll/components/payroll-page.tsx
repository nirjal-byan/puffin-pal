"use client";

import type { Permission } from "@puffinpal/permissions";
import { useCallback, useEffect, useState } from "react";
import { errorMessage, type WorkspaceApi } from "@/lib/api";
import type {
  PayrollDetails,
  PayrollEmployeeOption as EmployeeOption,
  PayrollEntry,
  PayrollRun,
  WorkforceReview,
} from "../types";
import { initialPayrollDates } from "../utils";
import { CreatePayrollDialog } from "./create-payroll-dialog";
import { PayrollRunDetails } from "./payroll-run-details";
import { PayrollRunsTable } from "./payroll-runs-table";

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
  const [form, setForm] = useState(() => ({ name: "", ...initialPayrollDates() }));
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
      <PayrollRunsTable runs={runs} onOpen={(run) => void open(run)} />
      {creating && (
        <CreatePayrollDialog
          form={form}
          employees={employees}
          employeeIds={employeeIds}
          busy={busy}
          onFormChange={setForm}
          onEmployeeIdsChange={setEmployeeIds}
          onClose={() => setCreating(false)}
          onCreate={() => void create()}
        />
      )}
      {selected && (
        <PayrollRunDetails
          api={api}
          run={selected}
          reviews={workforceReview}
          permissions={permissions}
          busy={busy}
          onClose={() => setSelected(null)}
          onAction={(nextAction) => void action(nextAction)}
          onReject={() => void reject()}
          onImportOvertime={(entry, overtimeId) => void importOvertime(entry, overtimeId)}
          onImportUnpaidLeave={(entry, leaveRequestId) =>
            void importUnpaidLeave(entry, leaveRequestId)
          }
          onAdjustment={(entry) => void adjustment(entry)}
          onPayment={(entry) => void payment(entry)}
          onDownload={(entry) => void download(entry)}
          onRetryPayslip={(entry) => void retryPayslip(entry)}
          onRefresh={() => open(selected)}
        />
      )}
    </>
  );
}
