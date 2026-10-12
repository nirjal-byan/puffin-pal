"use client";
import { useEffect, useRef, useState } from "react";
import type { Permission } from "@puffinpal/permissions";
import { ApiError, errorMessage, type WorkspaceApi } from "../../../lib/api";
import { issueInvoice } from "../api/invoices";
import { canIssueInvoice } from "../schemas/invoice.schema";
import type { InvoiceDetail } from "../types/invoice.types";

export function InvoiceIssueAction({
  invoice,
  permissions,
  api,
  currency,
  onIssued,
  onReload,
}: {
  invoice: InvoiceDetail;
  permissions: readonly Permission[];
  api: WorkspaceApi;
  currency: string;
  onIssued: (invoice: InvoiceDetail) => void;
  onReload: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pending = useRef(false);
  const [open, setOpen] = useState(false);
  const [reviewed, setReviewed] = useState(invoice);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const [reloadRequired, setReloadRequired] = useState(false);
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  async function issue() {
    if (pending.current || reloadRequired) return;
    pending.current = true;
    setBusy(true);
    setFailure("");
    try {
      const result = await issueInvoice(api, reviewed.id, reviewed.version);
      setOpen(false);
      onIssued(result);
    } catch (error) {
      setFailure(errorMessage(error));
      // A lost response may follow a committed issuance. Read before retrying.
      setReloadRequired(
        !(error instanceof ApiError) ||
          error.status === 409 ||
          error.status >= 500,
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  if (!canIssueInvoice(invoice.status, permissions)) return null;
  return (
    <div className="invoice-actions">
      <button
        type="button"
        className="button"
        onClick={() => {
          setReviewed(invoice);
          setFailure("");
          setReloadRequired(false);
          setOpen(true);
        }}
      >
        Issue Invoice
      </button>
      <dialog
        ref={dialog}
        className="invoice-delete-dialog"
        aria-label={`Issue ${reviewed.invoiceNumber}`}
        onCancel={(event) => {
          event.preventDefault();
          if (!pending.current) setOpen(false);
        }}
        onClose={() => setOpen(false)}
      >
        <h2>Issue invoice?</h2>
        <p className="invoice-number">{reviewed.invoiceNumber}</p>
        <p>
          {reviewed.client.name} · {currency} {reviewed.total}
        </p>
        <p>
          Issue date: {reviewed.issueDate.slice(0, 10)} · Due date:{" "}
          {reviewed.dueDate.slice(0, 10)}
        </p>
        <p>
          Issuing finalizes this invoice. Its billing details, dates and amounts
          will be locked, and it cannot be edited or deleted.
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
          {reloadRequired ? (
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
            <button
              type="button"
              className="button"
              disabled={busy}
              onClick={issue}
            >
              {busy ? "Issuing…" : "Confirm issuance"}
            </button>
          )}
        </div>
      </dialog>
    </div>
  );
}
