"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Permission } from "@puffinpal/permissions";
import { ApiError, errorMessage, type WorkspaceApi } from "@/lib/api";
import { deleteInvoice } from "../api/invoices";
import { draftActions } from "../schemas/invoice.schema";

export function InvoiceActions({
  invoice,
  permissions,
  api,
  onDeleted,
  onReload,
}: {
  invoice: {
    id: string;
    invoiceNumber: string;
    status?: string;
    version: number;
  };
  permissions: readonly Permission[];
  api: WorkspaceApi;
  onDeleted: () => void;
  onReload: () => void;
}) {
  const actions = draftActions(invoice.status, permissions);
  const dialog = useRef<HTMLDialogElement>(null);
  const pending = useRef(false);
  const [open, setOpen] = useState(false);
  const [reviewed, setReviewed] = useState(invoice);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const [conflict, setConflict] = useState(false);
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  async function remove() {
    if (pending.current || conflict) return;
    pending.current = true;
    setBusy(true);
    setFailure("");
    try {
      await deleteInvoice(api, reviewed.id, reviewed.version);
      window.dispatchEvent(
        new CustomEvent("puffinpal:tutorial-invoice-deleted", { detail: { id: reviewed.id } }),
      );
      setOpen(false);
      onDeleted();
    } catch (error) {
      setFailure(errorMessage(error));
      setConflict(error instanceof ApiError && error.status === 409);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="invoice-actions">
      {actions.edit && (
        <Link
          className="button secondary compact"
          data-tour="delete-draft"
          href={`/invoices/${invoice.id}/edit`}
        >
          Edit Draft
        </Link>
      )}
      {actions.delete && (
        <button
          className="button secondary compact"
          type="button"
          onClick={() => {
            setReviewed(invoice);
            setFailure("");
            setConflict(false);
            setOpen(true);
          }}
        >
          Delete Draft
        </button>
      )}
      <dialog
        ref={dialog}
        className="invoice-delete-dialog"
        aria-label={`Delete ${reviewed.invoiceNumber}`}
        onCancel={(event) => {
          event.preventDefault();
          if (!pending.current) setOpen(false);
        }}
        onClose={() => setOpen(false)}
      >
        <h2>Delete draft invoice?</h2>
        <p className="invoice-number">{reviewed.invoiceNumber}</p>
        <p>
          This permanently deletes the draft and all its line items. This action cannot be undone.
        </p>
        {failure && (
          <p className="alert" role="alert">
            {failure}
          </p>
        )}
        <div className="invoice-actions">
          <button
            autoFocus
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={() => setOpen(false)}
          >
            Cancel
          </button>
          {conflict ? (
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                setOpen(false);
                onReload();
              }}
            >
              Reload latest invoice
            </button>
          ) : (
            <button type="button" className="button danger" disabled={busy} onClick={remove}>
              {busy ? "Deleting…" : "Delete permanently"}
            </button>
          )}
        </div>
      </dialog>
    </div>
  );
}
