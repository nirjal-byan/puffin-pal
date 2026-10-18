"use client";
import Link from "next/link";
import type { Permission } from "@puffinpal/permissions";
import { InvoiceActions } from "../features/invoices/components/invoice-actions";
import { useEffect, useState } from "react";
import { errorMessage, type FinancialRecord, type InvoiceItem } from "../lib/api";
import type { WorkspaceApi } from "../lib/api";
import { InvoiceBulkExport } from "../features/invoices/components/invoice-bulk-export";

type FinancialTab = "invoices" | "expenses" | "retainers";
function money(value: string | undefined, currency: string) {
  if (!value) return "—";
  const parsed = Number(value);
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).format(parsed);
  } catch {
    return `${currency} ${value}`;
  }
}
function date(value?: string) {
  return value ? new Date(value).toLocaleDateString() : "—";
}
function InvoiceDetails({
  id,
  api,
  currency,
}: {
  id: string;
  api: WorkspaceApi;
  currency: string;
}) {
  const [items, setItems] = useState<InvoiceItem[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    api<InvoiceItem[]>(`/invoices/${id}/items?limit=100`, {
      signal: controller.signal,
    })
      .then(setItems)
      .catch((failure: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(failure));
      });
    return () => controller.abort();
  }, [api, id]);
  return (
    <div className="invoice-details">
      <h4>Invoice items</h4>
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      {items === null && !error && (
        <p className="muted" role="status">
          Loading items…
        </p>
      )}
      {items?.length === 0 && <p className="muted">No items on this invoice.</p>}
      {items && items.length > 0 && (
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
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.description}</td>
                  <td>{item.quantity}</td>
                  <td>{money(item.unitPrice, currency)}</td>
                  <td>{money(item.amount, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
export function FinancialPanel({
  tab,
  rows,
  currency,
  api,
  permissions = [],
  onDeleted = () => {},
}: {
  permissions?: readonly Permission[];
  onDeleted?: () => void;
  tab: FinancialTab;
  rows: FinancialRecord[];
  currency: string;
  api: WorkspaceApi;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const eligibleInvoices =
    tab === "invoices"
      ? rows.filter((row) => ["ISSUED", "PAID", "OVERDUE"].includes(row.status ?? ""))
      : [];
  const eligibleIds = new Set(eligibleInvoices.map((row) => row.id));
  const activeSelectedInvoices = selectedInvoices.filter((id) => eligibleIds.has(id));
  const allSelected =
    eligibleInvoices.length > 0 &&
    eligibleInvoices.every((row) => activeSelectedInvoices.includes(row.id));
  return (
    <section className="panel" data-tour={tab === "invoices" ? "invoice-list" : undefined}>
      <div className="panel-heading">
        <h3>
          {tab === "invoices"
            ? "Your invoices"
            : tab === "expenses"
              ? "Your expenses"
              : "Your retainers"}
        </h3>
        <div className="invoice-panel-tools">
          {tab === "invoices" && permissions.includes("invoices:read") && (
            <InvoiceBulkExport
              api={api}
              invoiceIds={activeSelectedInvoices}
              onComplete={() => setSelectedInvoices([])}
            />
          )}
          <span className="muted">{rows.length} on this page</span>
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="empty-state">
          <span className="empty-symbol">▤</span>
          <h3>No {tab} yet</h3>
          <p>Your organization’s records will appear here.</p>
        </div>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {tab === "invoices" && (
                  <th className="invoice-select-cell">
                    <input
                      type="checkbox"
                      aria-label="Select all eligible invoices on this page"
                      checked={allSelected}
                      disabled={eligibleInvoices.length === 0}
                      onChange={() =>
                        setSelectedInvoices(
                          allSelected ? [] : eligibleInvoices.map((row) => row.id),
                        )
                      }
                    />
                  </th>
                )}
                <th>
                  {tab === "invoices" ? "Invoice" : tab === "expenses" ? "Expense" : "Client"}
                </th>
                <th>Amount</th>
                <th>{tab === "expenses" ? "Date" : "Status"}</th>
                <th>
                  {tab === "invoices" ? "Due date" : tab === "retainers" ? "Billing day" : ""}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  {tab === "invoices" && (
                    <td className="invoice-select-cell">
                      <input
                        type="checkbox"
                        aria-label={`Select ${row.invoiceNumber ?? "invoice"}`}
                        disabled={!eligibleInvoices.some((invoice) => invoice.id === row.id)}
                        checked={activeSelectedInvoices.includes(row.id)}
                        onChange={() =>
                          setSelectedInvoices((current) =>
                            current.includes(row.id)
                              ? current.filter((id) => id !== row.id)
                              : [...current, row.id],
                          )
                        }
                      />
                    </td>
                  )}
                  <td>
                    {tab === "invoices" ? (
                      <div className="invoice-list-actions">
                        <Link
                          className="text-button invoice-number"
                          href={`/invoices/${row.id}`}
                          data-tour-payment-invoice={
                            ["ISSUED", "OVERDUE", "PAID"].includes(row.status ?? "")
                              ? row.status !== "PAID" &&
                                row.outstandingBalance &&
                                row.outstandingBalance !== "0.00"
                                ? "record"
                                : "read"
                              : undefined
                          }
                        >
                          {row.invoiceNumber} ↗
                        </Link>
                        <button
                          className="text-button"
                          type="button"
                          onClick={() => setSelected(selected === row.id ? null : row.id)}
                        >
                          Show items
                        </button>
                        {row.version !== undefined && (
                          <InvoiceActions
                            invoice={{
                              id: row.id,
                              invoiceNumber: row.invoiceNumber ?? "Invoice",
                              status: row.status,
                              version: row.version,
                            }}
                            api={api}
                            permissions={permissions}
                            onDeleted={onDeleted}
                            onReload={onDeleted}
                          />
                        )}
                      </div>
                    ) : (
                      <strong>{row.title ?? row.clientName}</strong>
                    )}
                  </td>
                  <td>
                    {tab === "invoices"
                      ? `${row.currency ?? currency} ${row.total}`
                      : money(
                          row.total ?? row.amount ?? row.monthlyAmount,
                          row.currency ?? currency,
                        )}
                    {tab === "invoices" && (
                      <div className="invoice-payment-summary muted">
                        <span>
                          Paid: {row.currency ?? currency} {row.totalPaid ?? "0.00"}
                        </span>
                        <span>
                          Due: {row.currency ?? currency} {row.outstandingBalance ?? row.total}
                        </span>
                      </div>
                    )}
                  </td>
                  <td>
                    {tab === "expenses" ? (
                      date(row.date)
                    ) : (
                      <span
                        className={`role-badge ${tab === "invoices" ? `invoice-status-${(row.displayStatus ?? row.status)?.toLowerCase()}` : ""}`}
                      >
                        {(row.displayStatus ?? row.status)?.toLowerCase() ??
                          (row.active ? "Active" : "Inactive")}
                      </span>
                    )}
                  </td>
                  <td>
                    {tab === "invoices"
                      ? date(row.dueDate)
                      : tab === "retainers"
                        ? row.billingDay
                        : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {selected && tab === "invoices" && (
        <InvoiceDetails
          key={selected}
          id={selected}
          api={api}
          currency={rows.find((row) => row.id === selected)?.currency ?? currency}
        />
      )}
    </section>
  );
}
