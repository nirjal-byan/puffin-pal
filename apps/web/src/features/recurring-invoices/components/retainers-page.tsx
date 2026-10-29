"use client";
import { useCallback, useEffect, useState } from "react";
import type { Permission } from "@puffinpal/permissions";
import { errorMessage, type Client, type WorkspaceApi } from "@/lib/api";
import { loadRecurringSchedule, loadRecurringWorkspace } from "../services/recurring-invoices-api";
import {
  emptyRecurringForm,
  scheduleToForm,
  type RecurringOccurrence,
  type RecurringSchedule,
} from "../types";
import { RetainerScheduleForm } from "./retainer-schedule-form";
import { RetainerSchedulesTable } from "./retainer-schedules-table";

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
  const [rows, setRows] = useState<RecurringSchedule[]>([]),
    [clients, setClients] = useState<Client[]>([]),
    [editing, setEditing] = useState<RecurringSchedule | null | "new">(null),
    [occurrences, setOccurrences] = useState<RecurringOccurrence[]>([]),
    [form, setForm] = useState(emptyRecurringForm),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
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
  async function retry(occurrence: RecurringOccurrence) {
    if (!editing || editing === "new") return;
    await api(`/recurring-invoices/${editing.id}/occurrences/${occurrence.id}/retry`, {
      method: "POST",
    });
    setOccurrences((current) =>
      current.map((value) =>
        value.id === occurrence.id ? { ...value, status: "PENDING" } : value,
      ),
    );
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
      <RetainerSchedulesTable
        rows={rows}
        currency={currency}
        permissions={permissions}
        onEdit={(row) => void open(row)}
        onTransition={(row, action) => void transition(row, action)}
      />
      {editing && (
        <RetainerScheduleForm
          isNew={editing === "new"}
          form={form}
          clients={clients}
          currency={currency}
          permissions={permissions}
          occurrences={occurrences}
          saving={saving}
          onChange={setForm}
          onClose={() => setEditing(null)}
          onSubmit={() => void save()}
          onRetry={(occurrence) => void retry(occurrence)}
        />
      )}
    </>
  );
}
