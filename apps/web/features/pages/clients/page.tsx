"use client";
import PageLayout from "./layout";
import { useState, type FormEvent } from "react";
import type { Client } from "../../../lib/api";

import type { WorkspaceApi } from "../../../lib/api";
export default function ClientsPage({
  clients,
  canCreate,
  canUpdate,
  api,
  onSaved,
  onError,
}: {
  clients: Client[];
  canCreate: boolean;
  canUpdate: boolean;
  api: WorkspaceApi;
  onSaved: (message: string) => void;
  onError: (error: unknown) => void;
}) {
  const [editing, setEditing] = useState<Client | null>(null);
  const [busy, setBusy] = useState(false);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    setBusy(true);
    try {
      const saved = await api<Client>(editing ? `/clients/${editing.id}` : "/clients", {
        method: editing ? "PATCH" : "POST",
        body: {
          name: String(fields.get("name")),
          email: String(fields.get("email")),
          companyName: String(fields.get("companyName")),
          taxId: String(fields.get("taxId")),
        },
      });
      if (!editing) window.dispatchEvent(new CustomEvent("puffinpal:tutorial-client-created", { detail: { id: saved.id } }));
      setEditing(null);
      form.reset();
      onSaved(editing ? "Client updated." : "Client added.");
    } catch (error) {
      onError(error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <PageLayout withForm={Boolean(canCreate || editing)}>
      <section className="panel">
        <div className="panel-heading">
          <h3>Your clients</h3>
          <span className="muted">{clients.length} on this page</span>
        </div>
        {clients.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Company</th>
                  <th>Tax ID</th>
                  {canUpdate && (
                    <th>
                      <span className="sr-only">Actions</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id}>
                    <td>
                      <strong>{client.name}</strong>
                      <small>{client.email}</small>
                    </td>
                    <td>{client.companyName || "—"}</td>
                    <td>{client.taxId || "—"}</td>
                    {canUpdate && (
                      <td>
                        <button
                          className="text-button"
                          type="button"
                          disabled={busy}
                          onClick={() => setEditing(client)}
                          aria-label={`Edit ${client.name}`}
                        >
                          Edit ↗
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <span className="empty-symbol">◈</span>
            <h3>A home for your clients</h3>
            <p>
              {canCreate
                ? "Add your first client to get started."
                : "No clients have been added to this workspace yet."}
            </p>
          </div>
        )}
      </section>
      {(canCreate || editing) && (
        <section className="panel form-panel" data-tour="client-form">
          <span className="eyebrow">Client details</span>
          <h3>{editing ? "Edit client" : "Add a client"}</h3>
          <form key={editing?.id ?? "new"} onSubmit={save}>
            <fieldset disabled={busy} className="form-fields">
              <label>
                Name
                <input
                  name="name"
                  data-tour-suggestion="PuffinPal Demo Client"
                  required
                  maxLength={120}
                  defaultValue={editing?.name}
                  placeholder="Client name"
                />
              </label>
              <label>
                Email
                <input
                  name="email"
                  data-tour-suggestion="demo.client@example.com"
                  type="email"
                  required
                  maxLength={254}
                  defaultValue={editing?.email}
                  placeholder="client@company.com"
                />
              </label>
              <label>
                Company <span className="optional">optional</span>
                <input
                  name="companyName"
                  data-tour-suggestion="Northstar Demo Co."
                  maxLength={120}
                  defaultValue={editing?.companyName ?? ""}
                  placeholder="Company name"
                />
              </label>
              <label>
                Tax ID <span className="optional">optional</span>
                <input
                  name="taxId"
                  data-tour-suggestion="DEMO-TAX-001"
                  maxLength={120}
                  defaultValue={editing?.taxId ?? ""}
                  placeholder="Tax identifier"
                />
              </label>
              <button className="button primary" type="submit">
                {busy ? "Saving…" : editing ? "Save changes" : "Add client +"}
              </button>
              {editing && (
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setEditing(null)}
                >
                  Cancel editing
                </button>
              )}
            </fieldset>
          </form>
        </section>
      )}
    </PageLayout>
  );
}
