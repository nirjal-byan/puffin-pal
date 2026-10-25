"use client";
import { useCallback, useEffect, useState } from "react";
import type { Permission } from "@puffinpal/permissions";
import { FormModal } from "@/components/ui/form-modal";
import { DatePicker } from "@/components/ui/date-picker";
import { Dropdown } from "@/components/ui/dropdown";
import { errorMessage, type Client, type WorkspaceApi } from "@/lib/api";
import { loadRecurringSchedule, loadRecurringWorkspace } from "@/features/recurring-invoices/api";
import {
  emptyRecurringForm,
  scheduleToForm,
  type RecurringOccurrence,
  type RecurringSchedule,
} from "@/features/recurring-invoices/types";

const BILLING_FREQUENCIES = [
  { value: "WEEKLY:1", label: "Every week" },
  { value: "WEEKLY:2", label: "Every 2 weeks" },
  { value: "MONTHLY:1", label: "Every month" },
  { value: "MONTHLY:2", label: "Every 2 months" },
  { value: "QUARTERLY:1", label: "Every quarter" },
  { value: "MONTHLY:6", label: "Every 6 months" },
  { value: "YEARLY:1", label: "Every year" },
  { value: "YEARLY:2", label: "Every 2 years" },
] as const;

const PAYMENT_TERMS = [
  { value: 0, label: "Due on receipt" },
  { value: 7, label: "Net 7 — due in 7 days" },
  { value: 14, label: "Net 14 — due in 14 days" },
  { value: 30, label: "Net 30 — due in 30 days" },
  { value: 45, label: "Net 45 — due in 45 days" },
  { value: 60, label: "Net 60 — due in 60 days" },
  { value: 90, label: "Net 90 — due in 90 days" },
] as const;

function frequencyLabel(frequency: string, interval: number) {
  const unit =
    frequency === "WEEKLY"
      ? "week"
      : frequency === "MONTHLY"
        ? "month"
        : frequency === "QUARTERLY"
          ? "quarter"
          : "year";
  return `Every ${interval > 1 ? `${interval} ` : ""}${unit}${interval > 1 ? "s" : ""}`;
}

export default function RetainersPage({
  api,
  currency,
  permissions,
  onSaved,
}: {
  api: WorkspaceApi;
  currency: string;
  permissions: readonly Permission[];
  onSaved: (message: string) => void;
}) {
  const [rows, setRows] = useState<RecurringSchedule[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [editing, setEditing] = useState<RecurringSchedule | null | "new">(null);
  const [occurrences, setOccurrences] = useState<RecurringOccurrence[]>([]);
  const [form, setForm] = useState(emptyRecurringForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    try {
      const workspace = await loadRecurringWorkspace(api);
      setRows(workspace.schedules);
      setClients(workspace.clients);
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }, [api]);
  useEffect(() => {
    let active = true;
    loadRecurringWorkspace(api)
      .then((workspace) => {
        if (active) {
          setRows(workspace.schedules);
          setClients(workspace.clients);
        }
      })
      .catch((failure: unknown) => {
        if (active) setError(errorMessage(failure));
      });
    return () => {
      active = false;
    };
  }, [api]);
  async function open(row?: RecurringSchedule) {
    setError("");
    setOccurrences([]);
    if (!row) {
      setForm(emptyRecurringForm());
      setEditing("new");
      return;
    }
    try {
      const details = await loadRecurringSchedule(api, row.id);
      setForm(scheduleToForm(details.schedule));
      setOccurrences(details.occurrences);
      setEditing(details.schedule);
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }
  async function save() {
    setSaving(true);
    setError("");
    try {
      const body = {
        ...form,
        endDate: form.endDate || undefined,
        ...(editing !== "new" && editing ? { expectedVersion: editing.version } : {}),
      };
      await api(editing === "new" ? "/recurring-invoices" : `/recurring-invoices/${editing!.id}`, {
        method: editing === "new" ? "POST" : "PATCH",
        body,
      });
      const created = editing === "new";
      setEditing(null);
      await load();
      onSaved(created ? "Recurring invoice created." : "Recurring invoice updated.");
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setSaving(false);
    }
  }
  async function transition(row: RecurringSchedule, action: "pause" | "resume" | "cancel") {
    try {
      await api(`/recurring-invoices/${row.id}/${action}`, {
        method: "POST",
        body: { expectedVersion: row.version },
      });
      await load();
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }
  return (
    <>
      <section className="panel recurring-toolbar">
        <div>
          <h3>Recurring billing</h3>
          <p className="muted">Generate repeat invoices and client retainers automatically.</p>
        </div>
        {permissions.includes("retainers:create") && (
          <button className="button primary" onClick={() => void open()}>
            + New schedule
          </button>
        )}
      </section>
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      <section className="panel" data-tour="retainer-list">
        <div className="panel-heading">
          <h3>Schedules</h3>
          <span className="muted">{rows.length} total</span>
        </div>
        {rows.length === 0 ? (
          <div className="empty-state">
            <span className="empty-symbol">↻</span>
            <h3>No recurring schedules</h3>
            <p>Create a schedule for repeat billing.</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Client</th>
                  <th>Amount</th>
                  <th>Frequency</th>
                  <th>Next invoice</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.name}</strong>
                      <small className="muted recurring-subtitle">
                        {row.autoIssue ? "Issues automatically" : "Creates a draft"}
                      </small>
                    </td>
                    <td>{row.clientName}</td>
                    <td>
                      {new Intl.NumberFormat("en", {
                        style: "currency",
                        currency: row.currency ?? currency,
                      }).format(Number(row.amount ?? 0))}
                    </td>
                    <td>
                      Every {row.interval > 1 ? `${row.interval} ` : ""}
                      {row.frequency.toLowerCase()}
                    </td>
                    <td>
                      {new Date(row.nextRunAt).toLocaleDateString()}
                      <small className="muted recurring-subtitle">
                        Last:{" "}
                        {row.lastRunAt
                          ? new Date(row.lastRunAt).toLocaleDateString()
                          : "Not generated"}
                      </small>
                    </td>
                    <td>
                      <span className={`status-badge status-${row.status.toLowerCase()}`}>
                        {row.status}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        {permissions.includes("retainers:update") && (
                          <button className="text-button" onClick={() => void open(row)}>
                            Edit
                          </button>
                        )}
                        {permissions.includes("retainers:update") && row.status === "ACTIVE" && (
                          <button
                            className="text-button"
                            onClick={() => void transition(row, "pause")}
                          >
                            Pause
                          </button>
                        )}
                        {permissions.includes("retainers:update") && row.status === "PAUSED" && (
                          <button
                            className="text-button"
                            onClick={() => void transition(row, "resume")}
                          >
                            Resume
                          </button>
                        )}
                        {permissions.includes("retainers:delete") &&
                          !["CANCELLED", "COMPLETED"].includes(row.status) && (
                            <button
                              className="text-button danger-text"
                              onClick={() => void transition(row, "cancel")}
                            >
                              Cancel
                            </button>
                          )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {editing && (
        <FormModal
          title={editing === "new" ? "Create recurring invoice" : "Edit recurring invoice"}
          badge="Schedule"
          wide
          onClose={() => setEditing(null)}
        >
          <form
            className="recurring-form workforce-form"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <section className="workforce-form-section">
              <div className="workforce-form-section-heading">
                <span>Schedule details</span>
                <small>Client and billing cadence</small>
              </div>
              <div className="workforce-form-grid workforce-form-grid-3">
                <label>
                  Schedule name
                  <input
                    required
                    maxLength={120}
                    placeholder="Monthly support retainer"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                  <small>Required</small>
                </label>
                <label>
                  Client
                  <Dropdown
                    name="recurring-client"
                    label="Client"
                    placeholder="Select client"
                    value={form.clientId}
                    onChange={(clientId) => setForm({ ...form, clientId })}
                    options={clients.map((client) => ({ value: client.id, label: client.name }))}
                  />
                  <small>Required</small>
                </label>
                <label>
                  Billing frequency
                  <Dropdown
                    name="recurring-frequency"
                    label="Billing frequency"
                    searchable={false}
                    value={`${form.frequency}:${form.interval}`}
                    onChange={(value) => {
                      const [frequency = "MONTHLY", interval = "1"] = value.split(":");
                      setForm({ ...form, frequency, interval: Number(interval) });
                    }}
                    options={
                      BILLING_FREQUENCIES.some(
                        (option) => option.value === `${form.frequency}:${form.interval}`,
                      )
                        ? [...BILLING_FREQUENCIES]
                        : [
                            {
                              value: `${form.frequency}:${form.interval}`,
                              label: frequencyLabel(form.frequency, form.interval),
                            },
                            ...BILLING_FREQUENCIES,
                          ]
                    }
                  />
                </label>
                <label>
                  Start date
                  <DatePicker
                    value={form.startDate}
                    onChange={(startDate) => setForm({ ...form, startDate })}
                    ariaLabel="Recurring invoice start date"
                  />
                </label>
                <label>
                  End date
                  <DatePicker
                    value={form.endDate}
                    onChange={(endDate) => setForm({ ...form, endDate })}
                    min={form.startDate || undefined}
                    ariaLabel="Recurring invoice end date"
                  />
                  <small>Optional</small>
                </label>
                <label>
                  Payment terms
                  <Dropdown
                    name="recurring-payment-terms"
                    label="Payment terms"
                    searchable={false}
                    value={String(form.dueDateOffsetDays)}
                    onChange={(value) => setForm({ ...form, dueDateOffsetDays: Number(value) })}
                    options={(PAYMENT_TERMS.some(
                      (option) => option.value === form.dueDateOffsetDays,
                    )
                      ? PAYMENT_TERMS
                      : [
                          {
                            value: form.dueDateOffsetDays,
                            label: `Due ${form.dueDateOffsetDays} days after issue`,
                          },
                          ...PAYMENT_TERMS,
                        ]
                    ).map((option) => ({ ...option, value: String(option.value) }))}
                  />
                </label>
              </div>
              <label>
                Description
                <textarea
                  rows={2}
                  placeholder="Optional note included with this recurring schedule"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
                <small>Optional</small>
              </label>
            </section>
            <fieldset className="recurring-items">
              <legend>Invoice line items</legend>
              <div className="recurring-item-head" aria-hidden="true">
                <span>Description</span>
                <span>Quantity</span>
                <span>Unit price ({currency})</span>
                <span />
              </div>
              {form.items.map((item, index) => (
                <div className="recurring-item" key={index}>
                  <input
                    aria-label={`Item ${index + 1} description`}
                    required
                    placeholder="Service or product"
                    value={item.description}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        items: form.items.map((value, itemIndex) =>
                          itemIndex === index ? { ...value, description: e.target.value } : value,
                        ),
                      })
                    }
                  />
                  <input
                    aria-label={`Item ${index + 1} quantity`}
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        items: form.items.map((value, itemIndex) =>
                          itemIndex === index
                            ? { ...value, quantity: Number(e.target.value) }
                            : value,
                        ),
                      })
                    }
                  />
                  <input
                    aria-label={`Item ${index + 1} unit price`}
                    inputMode="decimal"
                    value={item.unitPrice}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        items: form.items.map((value, itemIndex) =>
                          itemIndex === index ? { ...value, unitPrice: e.target.value } : value,
                        ),
                      })
                    }
                  />
                  {form.items.length > 1 && (
                    <button
                      type="button"
                      className="text-button danger-text"
                      onClick={() =>
                        setForm({
                          ...form,
                          items: form.items.filter((_, itemIndex) => itemIndex !== index),
                        })
                      }
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                className="button secondary compact"
                onClick={() =>
                  setForm({
                    ...form,
                    items: [...form.items, { description: "", quantity: 1, unitPrice: "0.00" }],
                  })
                }
              >
                + Add item
              </button>
            </fieldset>
            <label className="checkbox-label recurring-auto-issue">
              <input
                type="checkbox"
                checked={form.autoIssue}
                disabled={!permissions.includes("invoices:issue")}
                onChange={(e) => setForm({ ...form, autoIssue: e.target.checked })}
              />
              <span className="recurring-auto-copy">
                <strong>Issue invoices automatically</strong>
                <small>Finalize and store each invoice automatically on its scheduled date.</small>
              </span>
            </label>
            {editing !== "new" && occurrences.length > 0 && (
              <section className="recurring-history">
                <h4>Generated invoices</h4>
                {occurrences.map((occurrence) => (
                  <div key={occurrence.id}>
                    <span>
                      {new Date(occurrence.scheduledFor).toLocaleDateString()} · {occurrence.status}
                    </span>
                    {occurrence.invoiceId && (
                      <a className="text-button" href={`/invoices/${occurrence.invoiceId}`}>
                        View invoice ↗
                      </a>
                    )}
                    {occurrence.status === "FAILED" && (
                      <button
                        type="button"
                        className="text-button"
                        onClick={async () => {
                          await api(
                            `/recurring-invoices/${editing.id}/occurrences/${occurrence.id}/retry`,
                            { method: "POST" },
                          );
                          setOccurrences((current) =>
                            current.map((value) =>
                              value.id === occurrence.id ? { ...value, status: "PENDING" } : value,
                            ),
                          );
                        }}
                      >
                        Retry
                      </button>
                    )}
                  </div>
                ))}
              </section>
            )}
            <div className="workforce-form-actions">
              <button type="button" className="button secondary" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button className="button primary" disabled={saving}>
                {saving ? "Saving…" : "Save schedule"}
              </button>
            </div>
          </form>
        </FormModal>
      )}
    </>
  );
}
