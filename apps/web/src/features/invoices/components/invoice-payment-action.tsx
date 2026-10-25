"use client";
import { useRef, useState, type FormEvent } from "react";
import type { Permission } from "@puffinpal/permissions";
import { DatePicker } from "@/components/ui/date-picker";
import { Dropdown } from "@/components/ui/dropdown";
import { FormModal, FormModalIntro, FormModalSection } from "@/components/ui/form-modal";
import { ApiError, errorMessage, type WorkspaceApi } from "@/lib/api";
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
  const pending = useRef(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const [reloadRequired, setReloadRequired] = useState(false);
  const [reviewed, setReviewed] = useState(invoice);
  const [success, setSuccess] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState("BANK_TRANSFER");
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
            setPaymentDate(new Date().toISOString().slice(0, 10));
            setMethod("BANK_TRANSFER");
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
      {open && (
        <FormModal
          title="Record payment"
          badge={reviewed.invoiceNumber}
          onClose={() => {
            if (!pending.current) setOpen(false);
          }}
        >
          <form key={`${reviewed.id}-${reviewed.version}`} onSubmit={submit}>
            <FormModalIntro icon="$" title="Payment details">
              Record money received for this invoice. Payments become part of its permanent history.
            </FormModalIntro>
            <FormModalSection
              title="Amount and payment method"
              description={`${reviewed.currency} ${reviewed.outstandingBalance} outstanding`}
            >
              <fieldset
                className="form-fields standard-form-grid"
                disabled={busy || reloadRequired}
              >
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
                  <DatePicker
                    name="paymentDate"
                    ariaLabel="Payment date"
                    value={paymentDate}
                    onChange={setPaymentDate}
                    max={new Date().toISOString().slice(0, 10)}
                    disabled={busy || reloadRequired}
                  />
                </label>
                <label>
                  Payment method
                  <Dropdown
                    name="method"
                    label="Payment method"
                    value={method}
                    onChange={setMethod}
                    searchable={false}
                    disabled={busy || reloadRequired}
                    options={PAYMENT_METHODS.map((option) => ({
                      value: option.value,
                      label: option.label,
                    }))}
                  />
                </label>
                <label>
                  Reference <span className="muted">Optional</span>
                  <input name="reference" maxLength={120} />
                </label>
                <label className="invoice-field standard-form-grid-wide">
                  Notes <span className="muted">Optional</span>
                  <textarea name="notes" maxLength={2000} rows={3} />
                </label>
              </fieldset>
            </FormModalSection>
            {failure && (
              <p className="alert" role="alert">
                {failure}
              </p>
            )}
            <div className="standard-form-modal-actions">
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
        </FormModal>
      )}
    </div>
  );
}
