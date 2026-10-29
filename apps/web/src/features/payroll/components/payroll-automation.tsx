"use client";

import type { Permission } from "@puffinpal/permissions";
import { useCallback, useEffect, useState } from "react";
import { errorMessage, type WorkspaceApi } from "@/lib/api";
import type {
  PayrollNotification,
  PayrollSchedule,
  PayrollScheduleFormState,
  PayrollScheduleOccurrence,
} from "../types";
import { GeneratePayrollDialog } from "../dialogs/generate-payroll-dialog";
import {
  PayrollAutomationActions,
  PayrollAutomationHistory,
  PayrollAutomationOverview,
} from "./payroll-automation-overview";
import { PayrollScheduleDialog } from "../dialogs/payroll-schedule-dialog";

const today = () => new Date().toISOString().slice(0, 10);
const defaults: PayrollScheduleFormState = {
  name: "Standard payroll",
  frequency: "MONTHLY",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  startDate: `${today().slice(0, 8)}01`,
  generationTime: "09:00",
  paymentOffsetDays: "1",
};

export function PayrollAutomation({
  api,
  permissions,
  onSaved,
  onRunsChanged,
}: {
  api: WorkspaceApi;
  permissions: readonly Permission[];
  onSaved: (message: string) => void;
  onRunsChanged: () => Promise<void>;
}) {
  const [schedule, setSchedule] = useState<PayrollSchedule | null>(null);
  const [history, setHistory] = useState<PayrollScheduleOccurrence[]>([]);
  const [notifications, setNotifications] = useState<PayrollNotification[]>([]);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(defaults);
  const canManage = permissions.includes("payroll:manage");
  const load = useCallback(async () => {
    const schedules = await api<PayrollSchedule[]>("/payroll/schedules");
    const current = schedules[0] ?? null;
    setSchedule(current);
    const [events, inbox] = await Promise.all([
      current
        ? api<{ items: PayrollScheduleOccurrence[] }>(
            `/payroll/schedules/${current.id}/history?limit=20&offset=0`,
          )
        : Promise.resolve({ items: [] }),
      api<PayrollNotification[]>("/payroll/notifications"),
    ]);
    setHistory(events.items);
    setNotifications(inbox);
  }, [api]);
  useEffect(() => {
    let active = true;
    const start = window.setTimeout(() => {
      void load().catch((failure) => active && setError(errorMessage(failure)));
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(start);
    };
  }, [load]);
  function openForm() {
    if (schedule)
      setForm({
        name: schedule.name,
        frequency: schedule.frequency,
        timezone: schedule.timezone,
        startDate: schedule.startDate.slice(0, 10),
        generationTime: schedule.generationTime,
        paymentOffsetDays: String(schedule.paymentOffsetDays ?? ""),
      });
    else setForm(defaults);
    setEditing(true);
  }
  async function save() {
    setBusy(true);
    setError("");
    try {
      const body = {
        ...form,
        paymentOffsetDays:
          form.paymentOffsetDays === "" ? undefined : Number(form.paymentOffsetDays),
        ...(schedule ? { expectedVersion: schedule.version } : {}),
      };
      await api(schedule ? `/payroll/schedules/${schedule.id}` : "/payroll/schedules", {
        method: schedule ? "PATCH" : "POST",
        body,
      });
      setEditing(false);
      await load();
      onSaved(schedule ? "Payroll schedule updated." : "Payroll automation enabled.");
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  async function transition() {
    if (!schedule) return;
    setBusy(true);
    try {
      await api(
        `/payroll/schedules/${schedule.id}/${schedule.status === "ACTIVE" ? "pause" : "resume"}`,
        {
          method: "POST",
          body: { expectedVersion: schedule.version },
        },
      );
      await load();
      onSaved(
        schedule.status === "ACTIVE" ? "Payroll automation paused." : "Payroll automation resumed.",
      );
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  async function generate() {
    if (!schedule) return;
    setBusy(true);
    try {
      await api(`/payroll/schedules/${schedule.id}/generate`, { method: "POST" });
      setConfirming(false);
      await load();
      await onRunsChanged();
      onSaved("Payroll draft generation queued.");
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel payroll-automation">
      <div className="panel-heading payroll-automation-heading">
        <div>
          <span className="eyebrow">Automation</span>
          <h3>Payroll schedule</h3>
          <p className="muted">Prepare draft pay runs on a predictable schedule.</p>
        </div>
        {canManage && (
          <PayrollAutomationActions
            schedule={schedule}
            busy={busy}
            onEdit={openForm}
            onTransition={() => void transition()}
            onGenerate={() => setConfirming(true)}
          />
        )}
      </div>
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      <PayrollAutomationOverview
        schedule={schedule}
        notifications={notifications}
        onRead={(id) =>
          void api(`/payroll/notifications/${id}/read`, { method: "PATCH" }).then(load)
        }
      />
      {schedule && <PayrollAutomationHistory history={history} />}
      {editing && (
        <PayrollScheduleDialog
          schedule={schedule}
          form={form}
          busy={busy}
          onChange={setForm}
          onClose={() => setEditing(false)}
          onSubmit={save}
        />
      )}
      {confirming && (
        <GeneratePayrollDialog
          busy={busy}
          onClose={() => setConfirming(false)}
          onGenerate={() => void generate()}
        />
      )}
    </section>
  );
}
