"use client";
import type { Permission } from "@puffinpal/permissions";
import { useCallback, useEffect, useState } from "react";
import { errorMessage, type WorkspaceApi } from "@/lib/api";
import { loadEmployees, loadLeave } from "../services/workforce-api";
import type { EmployeeOption, LeaveBalance, LeaveRequest, LeaveType } from "../types";
import { shortDate } from "../types";
import { MetricCard } from "./workforce-ui";
import { LeaveRequestDialog, LeaveTypeDialog } from "../dialogs/leave-dialogs";
import { LeaveBalances, LeaveRequestsTable } from "./leave-overview";
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
  const applyData = (
    leave: [LeaveType[], LeaveRequest[], LeaveBalance[]],
    people: EmployeeOption[],
  ) => {
    setTypes(leave[0]);
    setRequests(leave[1]);
    setBalances(leave[2]);
    setEmployees(people);
  };
  const refresh = useCallback(async () => {
    const [leave, people] = await Promise.all([loadLeave(api), loadEmployees(api)]);
    applyData(leave, people);
  }, [api]);
  useEffect(() => {
    let active = true;
    Promise.all([loadLeave(api), loadEmployees(api)])
      .then(([leave, people]) => {
        if (active) applyData(leave, people);
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
  return (
    <>
      {error && (
        <div className="alert" role="alert">
          {error}
        </div>
      )}
      <section className="workforce-metrics" data-tour="leave-overview">
        <MetricCard
          label="Pending"
          value={requests.filter((r) => r.status === "PENDING_APPROVAL").length}
          detail="Awaiting review"
        />
        <MetricCard
          label="Approved"
          value={requests.filter((r) => r.status === "APPROVED").length}
          detail="Current history"
        />
        <MetricCard
          label="Upcoming"
          value={
            requests.filter(
              (r) =>
                r.status === "APPROVED" &&
                shortDate(r.startDate) >= new Date().toISOString().slice(0, 10),
            ).length
          }
          detail="Approved future leave"
        />
        <MetricCard
          label="Leave types"
          value={types.filter((t) => t.isActive).length}
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
      <LeaveBalances balances={balances} employees={employees} />
      <LeaveRequestsTable
        requests={requests}
        types={types}
        employees={employees}
        canApprove={can("leave:approve")}
        onReview={review}
      />
      {can("leave:manage") && (
        <LeavePolicyManagement api={api} types={types} employees={employees} onSaved={onSaved} />
      )}{" "}
      {open === "request" && (
        <LeaveRequestDialog
          form={form}
          employees={employees}
          types={types}
          onChange={setForm}
          onClose={() => setOpen(null)}
          onSubmit={createRequest}
        />
      )}{" "}
      {open === "type" && (
        <LeaveTypeDialog
          form={typeForm}
          onChange={setTypeForm}
          onClose={() => setOpen(null)}
          onSubmit={createType}
        />
      )}
    </>
  );
}
