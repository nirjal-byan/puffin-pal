"use client";
import Link from "next/link";
import type { Permission } from "@puffinpal/permissions";
import { InvoiceActions } from "../features/invoices/components/invoice-actions";
import { useEffect, useState } from "react";
import {
  errorMessage,
  type FinancialRecord,
  type InvoiceItem,
} from "../lib/api";
import type { WorkspaceApi } from "../lib/api";

type FinancialTab = "invoices" | "expenses" | "retainers";
function money(value: string | undefined, currency: string) {
  if (!value) return "—";
  const parsed = Number(value);
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).format(
      parsed,
    );
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
      {items?.length === 0 && (
        <p className="muted">No items on this invoice.</p>
      )}
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
  return (
    <section className="panel">
      <div className="panel-heading">
        <h3>
          {tab === "invoices"
            ? "Your invoices"
            : tab === "expenses"
              ? "Your expenses"
              : "Your retainers"}
        </h3>
        <span className="muted">{rows.length} on this page</span>
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
                <th>
                  {tab === "invoices"
                    ? "Invoice"
                    : tab === "expenses"
                      ? "Expense"
                      : "Client"}
                </th>
                <th>Amount</th>
                <th>{tab === "expenses" ? "Date" : "Status"}</th>
                <th>
                  {tab === "invoices"
                    ? "Due date"
                    : tab === "retainers"
                      ? "Billing day"
                      : ""}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    {tab === "invoices" ? (
                      <div className="invoice-list-actions">
                        <Link
                          className="text-button invoice-number"
                          href={`/invoices/${row.id}`}
                        >
                          {row.invoiceNumber} ↗
                        </Link>
                        <button
                          className="text-button"
                          type="button"
                          onClick={() =>
                            setSelected(selected === row.id ? null : row.id)
                          }
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
                    {money(
                      row.total ?? row.amount ?? row.monthlyAmount,
                      currency,
                    )}
                  </td>
                  <td>
                    {tab === "expenses" ? (
                      date(row.date)
                    ) : (
                      <span className="role-badge">
                        {row.status?.toLowerCase() ??
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
          currency={currency}
        />
      )}
    </section>
  );
}
