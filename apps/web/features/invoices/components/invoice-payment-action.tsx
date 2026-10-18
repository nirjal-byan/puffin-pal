"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Permission } from "@puffinpal/permissions";
import { ApiError, errorMessage, type WorkspaceApi } from "../../../lib/api";
import { recordInvoicePayment } from "../api/invoices";
import { canRecordPayment, PAYMENT_METHODS, validatePayment } from "../schemas/payment.schema";
import type { InvoiceDetail } from "../types/invoice.types";

export function InvoicePaymentAction({
  invoice,
  permissions,
  api,
  onRecorded,
  onReload,
}: {
  invoice: InvoiceDetail;
  permissions: readonly Permission[];
  api: WorkspaceApi;
  onRecorded: (invoice: InvoiceDetail) => void;
  onReload: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pending = useRef(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const [reloadRequired, setReloadRequired] = useState(false);
  const [reviewed, setReviewed] = useState(invoice);
  const [success, setSuccess] = useState("");
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || reloadRequired) return;
    const data = new FormData(event.currentTarget);
    const input = {
      amount: String(data.get("amount")).trim(),
      paymentDate: String(data.get("paymentDate")),
      method: String(data.get("method")),
      reference: String(data.get("reference")).trim(),
      notes: String(data.get("notes")).trim(),
    };
    const error = validatePayment(input, reviewed.outstandingBalance);
    if (error) {
      setFailure(error);
      return;
    }
    pending.current = true;
    setBusy(true);
    setFailure("");
    try {
      const result = await recordInvoicePayment(api, reviewed.id, {
        ...input,
        method: input.method as (typeof PAYMENT_METHODS)[number]["value"],
        expectedVersion: reviewed.version,
      });
      setOpen(false);
      setSuccess("Payment recorded successfully.");
      onRecorded(result);
    } catch (error) {
      setFailure(errorMessage(error));
      // A lost response may follow a committed payment; require a fresh history
      // before another submission instead of silently risking a duplicate.
      setReloadRequired(
        !(error instanceof ApiError) ||
          error.status === 0 ||
          error.status === 409 ||
          error.status >= 500,
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="invoice-actions">
      {canRecordPayment(invoice, permissions) && (
        <button
          type="button"
          className="button primary"
          data-tour="record-payment"
          onClick={() => {
            setReviewed(invoice);
            setFailure("");
            setSuccess("");
            setReloadRequired(false);
            setOpen(true);
          }}
        >
          Record Payment
        </button>
      )}
      {success && (
        <p className="notice" role="status">
          {success}
        </p>
      )}
      <dialog
        ref={dialog}
        className="invoice-delete-dialog invoice-payment-dialog"
        aria-label="Record payment"
        onCancel={(event) => {
          event.preventDefault();
          if (!pending.current) setOpen(false);
        }}
        onClose={() => setOpen(false)}
      >
        <h2>Record payment</h2>
        <p className="invoice-number">{reviewed.invoiceNumber}</p>
        <p>
          Outstanding: {reviewed.currency} {reviewed.outstandingBalance}
        </p>
        <p className="muted">
          Record money already received. Payments cannot be edited or removed.
        </p>
        {failure && (
          <p className="alert" role="alert">
            {failure}
          </p>
        )}
        {open && (
          <form key={`${reviewed.id}-${reviewed.version}`} onSubmit={submit}>
            <fieldset className="form-fields" disabled={busy || reloadRequired}>
              <label>
                Amount ({reviewed.currency})
                <input
                  autoFocus
                  name="amount"
                  inputMode="decimal"
                  required
                  maxLength={13}
                  defaultValue={reviewed.outstandingBalance}
                />
              </label>
              <label>
                Payment date (UTC)
                <input
                  name="paymentDate"
                  type="date"
                  required
                  max={new Date().toISOString().slice(0, 10)}
                  defaultValue={new Date().toISOString().slice(0, 10)}
                />
              </label>
              <label>
                Payment method
                <select name="method" defaultValue="BANK_TRANSFER" required>
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method.value} value={method.value}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Reference (optional)
                <input name="reference" maxLength={120} />
              </label>
              <label className="invoice-field">
                Notes (optional)
                <textarea name="notes" maxLength={2000} rows={3} />
              </label>
            </fieldset>
            <div className="invoice-actions">
              <button
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
                  Reload payment history
                </button>
              ) : (
                <button type="submit" className="button primary" disabled={busy}>
                  {busy ? "Recording…" : "Confirm payment"}
                </button>
              )}
            </div>
          </form>
        )}
      </dialog>
    </div>
  );
}
