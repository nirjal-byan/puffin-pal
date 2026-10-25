"use client";

import type { Permission } from "@puffinpal/permissions";
import { useCallback, useEffect, useState } from "react";
import { AppModal } from "@/components/ui/app-modal";
import { DatePicker } from "@/components/ui/date-picker";
import { Dropdown } from "@/components/ui/dropdown";
import {
  FormField,
  FormModal,
  FormModalIntro,
  FormModalSection,
} from "@/components/ui/form-modal";
import { errorMessage, type WorkspaceApi } from "@/lib/api";

type Schedule = {
  id: string;
  name: string;
  frequency: "WEEKLY" | "BIWEEKLY" | "SEMIMONTHLY" | "MONTHLY";
  timezone: string;
  startDate: string;
  generationTime: string;
  paymentOffsetDays: number | null;
  status: "ACTIVE" | "PAUSED";
  lastSuccessfulAt: string | null;
  nextRunAt: string;
  version: number;
};
type Occurrence = {
  id: string;
  payrollRunId: string | null;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  source: "SCHEDULED" | "MANUAL";
  status: string;
  attempts: number;
  failureMessage: string | null;
};
type Notification = {
  id: string;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
};

const today = () => new Date().toISOString().slice(0, 10);
type ScheduleForm = {
  name: string;
  frequency: Schedule["frequency"];
  timezone: string;
  startDate: string;
  generationTime: string;
  paymentOffsetDays: string;
};
const defaults: ScheduleForm = {
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
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [history, setHistory] = useState<Occurrence[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(defaults);
  const canManage = permissions.includes("payroll:manage");
  const load = useCallback(async () => {
    const schedules = await api<Schedule[]>("/payroll/schedules");
    const current = schedules[0] ?? null;
    setSchedule(current);
    const [events, inbox] = await Promise.all([
      current
        ? api<{ items: Occurrence[] }>(`/payroll/schedules/${current.id}/history?limit=20&offset=0`)
        : Promise.resolve({ items: [] }),
      api<Notification[]>("/payroll/notifications"),
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
          <div className="form-actions">
            {schedule && (
              <button className="button secondary" onClick={openForm}>
                Edit
              </button>
            )}
            {schedule && (
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => void transition()}
              >
                {schedule.status === "ACTIVE" ? "Pause" : "Resume"}
              </button>
            )}
            {schedule && schedule.status === "ACTIVE" && (
              <button className="button primary" onClick={() => setConfirming(true)}>
                Generate due draft
              </button>
            )}
            {!schedule && (
              <button className="button primary" onClick={openForm}>
                Set up automation
              </button>
            )}
          </div>
        )}
      </div>
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      {schedule ? (
        <div className="payroll-automation-grid">
          <article className="payroll-schedule-card">
            <div>
              <span className={`status-dot ${schedule.status.toLowerCase()}`} />
              <strong>{schedule.name}</strong>
            </div>
            <dl>
              <div>
                <dt>Frequency</dt>
                <dd>{schedule.frequency.toLowerCase().replace("biweekly", "Every two weeks")}</dd>
              </div>
              <div>
                <dt>Next draft</dt>
                <dd>{new Date(schedule.nextRunAt).toLocaleString()}</dd>
              </div>
              <div>
                <dt>Timezone</dt>
                <dd>{schedule.timezone}</dd>
              </div>
              <div>
                <dt>Last generated</dt>
                <dd>
                  {schedule.lastSuccessfulAt
                    ? new Date(schedule.lastSuccessfulAt).toLocaleString()
                    : "Not yet"}
                </dd>
              </div>
            </dl>
            <p className="muted">
              Drafts are calculated automatically. Approval, finalization, payslips, and payments
              always require authorized action.
            </p>
          </article>
          <article className="payroll-reminders">
            <div className="panel-heading">
              <h3>Reminders</h3>
              <span className="muted">
                {notifications.filter((item) => !item.readAt).length} unread
              </span>
            </div>
            {notifications.length ? (
              notifications.slice(0, 4).map((item) => (
                <button
                  key={item.id}
                  className={item.readAt ? "is-read" : ""}
                  onClick={() =>
                    void api(`/payroll/notifications/${item.id}/read`, { method: "PATCH" }).then(
                      load,
                    )
                  }
                >
                  <strong>{item.title}</strong>
                  <span>{item.message}</span>
                </button>
              ))
            ) : (
              <p className="muted payroll-empty-copy">No payroll reminders.</p>
            )}
          </article>
        </div>
      ) : (
        <div className="payroll-automation-empty">
          <span className="payroll-feature-icon" aria-hidden="true">
            ↻
          </span>
          <div>
            <strong>Automation is not configured</strong>
            <p>Choose a cadence and PuffinPal will prepare calculated drafts for review.</p>
          </div>
        </div>
      )}
      {schedule && history.length > 0 && (
        <div className="payroll-automation-history">
          <div className="panel-heading">
            <h3>Automation history</h3>
            <span className="muted">Latest 20 attempts</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Source</th>
                  <th>Result</th>
                  <th>Attempts</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {item.periodStart.slice(0, 10)} – {item.periodEnd.slice(0, 10)}
                    </td>
                    <td>{item.source.toLowerCase()}</td>
                    <td>
                      <span className="role-badge">{item.status}</span>
                    </td>
                    <td>{item.attempts}</td>
                    <td>
                      {item.failureMessage ?? (item.payrollRunId ? "Draft created" : "Queued")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {editing && (
        <FormModal
          title={schedule ? "Edit payroll schedule" : "Set up payroll automation"}
          badge="Drafts only"
          onClose={() => setEditing(false)}
          onSubmit={save}
          submitLabel="Save schedule"
          submitting={busy}
          submitDisabled={!form.name.trim() || !form.timezone.trim()}
        >
          <FormModalIntro icon="↻" title="Prepare payroll automatically">
            Choose the payroll cadence, period start, and local draft creation time. Generated runs
            always remain drafts for review.
          </FormModalIntro>
          <FormModalSection title="Schedule details" description="Required payroll settings">
            <div className="standard-form-grid">
              <FormField label="Schedule name">
                <input
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </FormField>
              <FormField label="Frequency">
                <Dropdown
                  name="payroll-frequency"
                  label="Payroll frequency"
                  searchable={false}
                  value={form.frequency}
                  onChange={(frequency) =>
                    setForm({ ...form, frequency: frequency as Schedule["frequency"] })
                  }
                  options={[
                    { value: "WEEKLY", label: "Every week" },
                    { value: "BIWEEKLY", label: "Every two weeks" },
                    { value: "SEMIMONTHLY", label: "Twice a month" },
                    { value: "MONTHLY", label: "Every month" },
                  ]}
                />
              </FormField>
              <FormField label="First period starts">
                <DatePicker
                  value={form.startDate}
                  onChange={(startDate) => setForm({ ...form, startDate })}
                  ariaLabel="First payroll period start date"
                />
              </FormField>
              <FormField label="Timezone">
                <input
                  value={form.timezone}
                  onChange={(event) => setForm({ ...form, timezone: event.target.value })}
                  placeholder="America/Toronto"
                />
              </FormField>
              <FormField label="Create draft at">
                <Dropdown
                  name="payroll-generation-time"
                  label="Draft creation time"
                  searchable={false}
                  value={form.generationTime}
                  onChange={(generationTime) => setForm({ ...form, generationTime })}
                  options={Array.from({ length: 48 }, (_, index) => {
                    const hour = Math.floor(index / 2);
                    const minute = index % 2 ? "30" : "00";
                    const value = `${String(hour).padStart(2, "0")}:${minute}`;
                    const label = new Date(2000, 0, 1, hour, Number(minute)).toLocaleTimeString(
                      [],
                      {
                        hour: "numeric",
                        minute: "2-digit",
                      },
                    );
                    return { value, label };
                  })}
                />
              </FormField>
              <FormField label="Intended payment timing" optional>
                <Dropdown
                  name="payroll-payment-timing"
                  label="Intended payment timing"
                  searchable={false}
                  value={form.paymentOffsetDays}
                  onChange={(paymentOffsetDays) => setForm({ ...form, paymentOffsetDays })}
                  options={[
                    { value: "", label: "No intended date" },
                    { value: "0", label: "On the period end date" },
                    { value: "1", label: "1 day after period end" },
                    { value: "3", label: "3 days after period end" },
                    { value: "5", label: "5 days after period end" },
                    { value: "7", label: "7 days after period end" },
                  ]}
                />
              </FormField>
            </div>
            {form.frequency === "SEMIMONTHLY" && (
              <p className="field-hint">
                Semimonthly periods run from the 1st–15th and 16th–month end. Choose the 1st or 16th
                as the start date.
              </p>
            )}
          </FormModalSection>
        </FormModal>
      )}
      {confirming && (
        <AppModal
          title="Generate payroll draft?"
          badge="Draft only"
          onClose={() => setConfirming(false)}
        >
          <div className="confirmation-copy">
            <p>
              This queues the currently due period and calculates a draft using eligible employees
              and effective salary structures.
            </p>
            <p>No payroll will be approved, finalized, or paid.</p>
            <div className="form-actions">
              <button className="button secondary" onClick={() => setConfirming(false)}>
                Cancel
              </button>
              <button className="button primary" disabled={busy} onClick={() => void generate()}>
                Generate draft
              </button>
            </div>
          </div>
        </AppModal>
      )}
    </section>
  );
}
