"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Permission } from "@puffinpal/permissions";
import { ApiError, errorMessage, type WorkspaceApi } from "../../../lib/api";
import { getInvoice } from "../api/invoices";
import { draftActions } from "../schemas/invoice.schema";
import type { InvoiceDetail } from "../types/invoice.types";
import { InvoiceIssueAction } from "./invoice-issue-action";
import { InvoicePdfAction } from "./invoice-pdf-action";
import { InvoicePaymentAction } from "./invoice-payment-action";
import { InvoicePaymentHistory } from "./invoice-payment-history";
import { InvoiceActions } from "./invoice-actions";
import { InvoiceForm } from "./invoice-form";

export function InvoiceDetailPage({
  id,
  editing,
  api,
  permissions,
  currency,
  modal = false,
}: {
  id: string;
  editing: boolean;
  api: WorkspaceApi;
  permissions: readonly Permission[];
  currency: string;
  modal?: boolean;
}) {
  const router = useRouter();
  const loaded = useRef(false);
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [failure, setFailure] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    // Keep the form snapshot stable across access-token renewal. Reloading an
    // editable draft is always an explicit action that discards local input.
    if (editing && loaded.current) return;
    const abort = new AbortController();
    getInvoice(api, id, abort.signal)
      .then((value) => {
        if (!abort.signal.aborted) {
          loaded.current = true;
          setInvoice(value);
        }
      })
      .catch((error) => {
        if (!abort.signal.aborted) {
          setNotFound(error instanceof ApiError && error.status === 404);
          setFailure(errorMessage(error));
        }
      });
    return () => abort.abort();
  }, [api, id, revision, editing]);
  function reload() {
    loaded.current = false;
    setInvoice(null);
    setFailure("");
    setNotFound(false);
    setRevision((value) => value + 1);
  }
  if (failure)
    return (
      <section className="panel empty-state">
        <h2>{notFound ? "Invoice not found" : "Could not load invoice"}</h2>
        <p role="alert">
          {notFound
            ? "This invoice is unavailable in your organization."
            : failure}
        </p>
        <Link className="button secondary" href="/invoices">
          Back to Invoices
        </Link>
        {!notFound && (
          <button type="button" className="button secondary" onClick={reload}>
            Try again
          </button>
        )}
      </section>
    );
  if (!invoice)
    return (
      <section className="panel loading" role="status">
        <span className="spinner" />
        Loading invoice…
      </section>
    );
  if (editing)
    return (
      <>
        {!modal && <Link className="text-button" href={`/invoices/${id}`}>
          ← Back to invoice
        </Link>}
        {!modal && <h2 className="invoice-number">{invoice.invoiceNumber}</h2>}
        {draftActions(invoice.status, permissions).edit ? (
          <InvoiceForm
            key={`${id}-${revision}`}
            api={api}
            initialInvoice={invoice}
            onReload={reload}
            modalActions={modal}
            onCreated={() => router.push(`/invoices/${id}`)}
          />
        ) : (
          <section className="panel empty-state">
            <h2>Draft editing unavailable</h2>
            <p>
              Only drafts can be edited by members with invoice update
              permission.
            </p>
          </section>
        )}
      </>
    );
  return (
    <>
      <div className="invoice-form-actions">
        <Link className="button secondary" href="/invoices">
          ← Back to Invoices
        </Link>
        <InvoiceIssueAction
          invoice={invoice}
          permissions={permissions}
          api={api}
          currency={currency}
          onIssued={setInvoice}
          onReload={reload}
        />
        <InvoiceActions
          invoice={invoice}
          permissions={permissions}
          api={api}
          onReload={reload}
          onDeleted={() => router.push("/invoices")}
        />
        <InvoicePdfAction invoice={invoice} permissions={permissions} api={api} />
        <InvoicePaymentAction invoice={invoice} permissions={permissions} api={api} onRecorded={setInvoice} onReload={reload} />
      </div>
      <InvoiceDetailView invoice={invoice} currency={currency} />
      <InvoicePaymentHistory invoice={invoice} />
    </>
  );
}

export function InvoiceDetailView({
  invoice,
  currency,
}: {
  invoice: InvoiceDetail;
  currency: string;
}) {
  // Keep decimal strings intact; organization currency is a display convention.
  const amount = (value: string) => `${invoice.currency ?? currency} ${value}`;
  return (
    <section className="panel invoice-document">
      <div className="panel-heading">
        <div className="invoice-heading-copy">
          <span className="invoice-heading-label">Invoice</span>
          <h2 className="invoice-number">{invoice.invoiceNumber}</h2>
        </div>
        <div className="invoice-heading-status">
          {invoice.issuedAt && (
            <p className="muted invoice-issued-meta" role="status">
              Issued by <strong>{invoice.sellerName}</strong> on {invoice.issuedAt.slice(0, 10)}
            </p>
          )}
          <span className={`role-badge invoice-status-${invoice.displayStatus.toLowerCase()}`}>{invoice.displayStatus}</span>
        </div>
      </div>
      <div className="invoice-document-meta">
        <div className="invoice-party">
          <span className="invoice-section-label">Bill to</span>
          <strong>{invoice.client.name}</strong>
          <p>{invoice.client.companyName}</p>
          <p>{invoice.client.email}</p>
          {invoice.client.taxId && <p>Tax ID: {invoice.client.taxId}</p>}
        </div>
        <dl className="invoice-dates">
          <dt>Issue date</dt>
          <dd>{invoice.issueDate.slice(0, 10)}</dd>
          <dt>Due date</dt>
          <dd>{invoice.dueDate.slice(0, 10)}</dd>
        </dl>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th>Quantity</th>
              <th>Unit price</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item) => (
              <tr key={item.id}>
                <td>{item.description}</td>
                <td>{item.quantity}</td>
                <td>{amount(item.unitPrice)}</td>
                <td>{amount(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="invoice-document-bottom">
        <div>
          <h3>Notes</h3>
          <p className="invoice-notes">{invoice.notes || "No notes."}</p>
        </div>
        <dl className="invoice-detail-totals" data-tour="invoice-balances">
          <dt>Subtotal</dt>
          <dd>{amount(invoice.subtotal)}</dd>
          <dt>Tax</dt>
          <dd>{amount(invoice.tax)}</dd>
          <dt>Total</dt>
          <dd>
            <strong>{amount(invoice.total)}</strong>
          </dd>
          <dt>Total paid</dt><dd>{amount(invoice.totalPaid)}</dd>
          <dt>Outstanding</dt><dd><strong>{amount(invoice.outstandingBalance)}</strong></dd>
        </dl>
      </div>
    </section>
  );
}
