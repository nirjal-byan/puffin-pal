"use client";
import type { Permission } from "@puffinpal/permissions";
import { useCallback, useEffect, useState } from "react";
import { errorMessage, type WorkspaceApi } from "@/lib/api";
import { loadEmployees, loadOvertime } from "../api";
import type { EmployeeOption, OvertimeRequest } from "../types";
import { MetricCard } from "../workforce-ui";
import {
  OvertimeRequestDialog,
  OvertimeRequestsTable,
  type OvertimeForm,
} from "./overtime-components";

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
  const [form, setForm] = useState<OvertimeForm>({
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
      <OvertimeRequestsTable
        requests={requests}
        employees={employees}
        canApprove={can("overtime:approve")}
        onReview={review}
      />
      {open && (
        <OvertimeRequestDialog
          form={form}
          employees={employees}
          onChange={setForm}
          onClose={() => setOpen(false)}
          onSubmit={create}
        />
      )}
    </>
  );
}
