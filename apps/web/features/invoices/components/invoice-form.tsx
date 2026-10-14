"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ApiError, errorMessage, type WorkspaceApi } from "../../../lib/api";
import { useCreateInvoice } from "../hooks/use-create-invoice";
import {
  addLine,
  removeLine,
  newLine,
  invoicePayload,
  validateInvoice,
  invoiceDraft,
} from "../schemas/invoice.schema";
import type {
  CreatedInvoice,
  InvoiceDetail,
  InvoiceDraft,
  InvoiceLine,
} from "../types/invoice.types";
import { InvoiceClientSelect } from "./invoice-client-select";
import { InvoiceLineItems } from "./invoice-line-items";
import { InvoiceSummary } from "./invoice-summary";
export function InvoiceForm({
  api,
  onCreated,
  initialInvoice,
  onReload,
}: {
  api: WorkspaceApi;
  initialInvoice?: InvoiceDetail;
  onReload?: () => void;
  onCreated: (invoice: CreatedInvoice) => void;
}) {
  const tutorialClient = useSearchParams().get("tutorialClient") ?? "";
  const [suggestedDueDate] = useState(() =>
    new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
  );
  const [draft, setDraft] = useState<InvoiceDraft>(() =>
    initialInvoice
      ? invoiceDraft(initialInvoice)
      : {
          clientId: tutorialClient,
          issueDate: new Date().toISOString().slice(0, 10),
          dueDate: "",
          notes: "",
          items: [newLine("first-item")],
        },
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState("");
  const [conflict, setConflict] = useState(false);
  const { save, saving } = useCreateInvoice(api, initialInvoice);
  const cancelHref = initialInvoice
    ? `/invoices/${initialInvoice.id}`
    : "/invoices";
  function update(patch: Partial<InvoiceDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }
  function updateLine(id: string, patch: Partial<InvoiceLine>) {
    setDraft((current) => ({
      ...current,
      items: current.items.map((line) =>
        line.id === id ? { ...line, ...patch } : line,
      ),
    }));
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || conflict) return;
    const nextErrors = validateInvoice(draft);
    setErrors(nextErrors);
    setFailure("");
    if (Object.keys(nextErrors).length) return;
    try {
      const payload = invoicePayload(draft);
      if (initialInvoice) payload.notes = draft.notes.trim();
      const invoice = await save(payload);
      if (invoice) {
        window.dispatchEvent(new CustomEvent("puffinpal:tutorial-invoice-created", { detail: { id: invoice.id, version: invoice.version ?? 0 } }));
        onCreated(invoice);
      }
    } catch (error) {
      setFailure(errorMessage(error));
      if (error instanceof ApiError && error.status === 409) setConflict(true);
    }
  }
  return (
    <form id="invoice-create-form" data-tour="invoice-create-form" onSubmit={submit} noValidate>
      <div className="invoice-form-actions">
        <span className="role-badge">Draft</span>
        <div>
          <Link
            href={cancelHref}
            className={`button secondary ${saving ? "invoice-disabled-link" : ""}`}
            aria-disabled={saving}
            tabIndex={saving ? -1 : 0}
            onClick={(event) => {
              if (saving) event.preventDefault();
            }}
          >
            Cancel
          </Link>
          <button
            type="submit"
            className="button primary"
            disabled={saving || conflict}
          >
            {saving
              ? "Saving draft…"
              : initialInvoice
                ? "Save Changes"
                : "Save as Draft"}
          </button>
        </div>
      </div>
      {failure && (
        <p className="alert" role="alert">
          {failure}
        </p>
      )}
      {conflict && (
        <div className="notice" role="alert">
          Your changes have not been saved. Review the latest invoice before
          editing again.
          <Link className="text-button" href={cancelHref}>
            Review latest invoice
          </Link>
          <button type="button" className="button secondary" onClick={onReload}>
            Discard my changes and reload
          </button>
        </div>
      )}
      {Object.keys(errors).length > 0 && (
        <p className="invoice-validation-summary" role="alert">
          Check the highlighted fields before saving.
        </p>
      )}
      <div className="invoice-form-grid">
        <div className="invoice-form-sections">
          <InvoiceClientSelect
            api={api}
            initialClient={initialInvoice?.client}
            value={draft.clientId}
            onChange={(clientId) => update({ clientId })}
            error={errors.clientId}
            disabled={saving}
          />
          <section className="panel invoice-section">
            <div className="panel-heading">
              <h3>Invoice information</h3>
            </div>
            <fieldset disabled={saving} className="invoice-section-body">
              <div className="invoice-date-fields">
                {(["issueDate", "dueDate"] as const).map((field) => (
                  <label className="invoice-field" key={field}>
                    {field === "issueDate" ? "Issue date" : "Due date"}
                    <input
                      aria-label={
                        field === "issueDate" ? "Issue date" : "Due date"
                      }
                      type="date"
                      name={field}
                      data-tour-suggestion={field === "dueDate" ? suggestedDueDate : undefined}
                      onKeyDown={(event) => {
                        if (event.key === "Tab" && !event.shiftKey && !draft[field] && field === "dueDate") {
                          event.preventDefault(); update({ dueDate: suggestedDueDate });
                        }
                      }}
                      value={draft[field]}
                      onChange={(event) =>
                        update({ [field]: event.target.value })
                      }
                      min={field === "dueDate" ? draft.issueDate : undefined}
                      aria-invalid={Boolean(errors[field])}
                      aria-describedby={
                        errors[field] ? `${field}-error` : undefined
                      }
                    />
                    {errors[field] && (
                      <span
                        id={`${field}-error`}
                        className="invoice-field-error"
                      >
                        {errors[field]}
                      </span>
                    )}
                  </label>
                ))}
              </div>
              <label className="invoice-field">
                Notes <span className="optional">optional</span>
                <textarea
                  value={draft.notes}
                  onChange={(event) => update({ notes: event.target.value })}
                  rows={3}
                  maxLength={5000}
                  placeholder="Add any context for this invoice."
                  aria-invalid={Boolean(errors.notes)}
                />
                {errors.notes && (
                  <span className="invoice-field-error">{errors.notes}</span>
                )}
              </label>
            </fieldset>
          </section>
          <InvoiceLineItems
            items={draft.items}
            onChange={updateLine}
            onAdd={() =>
              setDraft((current) => ({
                ...current,
                items: addLine(current.items, crypto.randomUUID()),
              }))
            }
            onRemove={(id) =>
              setDraft((current) => ({
                ...current,
                items: removeLine(current.items, id),
              }))
            }
            errors={errors}
            disabled={saving}
          />
        </div>
        <InvoiceSummary items={draft.items} />
      </div>
    </form>
  );
}
