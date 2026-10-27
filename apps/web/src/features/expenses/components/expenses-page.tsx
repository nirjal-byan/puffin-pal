"use client";
import type { Permission } from "@puffinpal/permissions";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { errorMessage, type WorkspaceApi } from "@/lib/api";
import { validateExpense, validateReceiptFile } from "../../expenses/schemas/expense.schema";
import { AppModal } from "@/components/ui/app-modal";
import { Dropdown } from "@/components/ui/dropdown";
import { FormModal } from "@/components/ui/form-modal";
import { EXPENSE_CATEGORIES, type Expense, type ExpensePage } from "../../expenses/types";
import { expensePeriodRange, formatExpenseMoney } from "../../expenses/utils";
import { ExpenseForm } from "./expense-form";

export default function ExpensesPage({
  api,
  currency,
  permissions,
  onSaved,
  onError,
}: {
  api: WorkspaceApi;
  currency: string;
  permissions: readonly Permission[];
  onSaved: (message: string) => void;
  onError: (error: unknown) => void;
}) {
  const canCreate = permissions.includes("expenses:create"),
    canUpdate = permissions.includes("expenses:update"),
    canDelete = permissions.includes("expenses:delete"),
    canSubmit = permissions.includes("expenses:submit"),
    canApprove = permissions.includes("expenses:approve");
  const [page, setPage] = useState<ExpensePage>({
    items: [],
    total: 0,
    pendingCount: 0,
    limit: 20,
    offset: 0,
  });
  const [offset, setOffset] = useState(0);
  const [filters, setFilters] = useState({
    search: "",
    category: "",
    approvalStatus: "",
    period: "",
    sort: "date",
    order: "desc",
  });
  const [applied, setApplied] = useState(filters);
  const [editing, setEditing] = useState<Expense | null>(null),
    [creating, setCreating] = useState(false),
    [deleting, setDeleting] = useState<Expense | null>(null);
  const [selected, setSelected] = useState<Expense | null>(null);
  const [workflow, setWorkflow] = useState<{
    expense: Expense;
    action: "submit" | "approve" | "reject" | "reopen";
  } | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [failure, setFailure] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setFailure("");
    const query = new URLSearchParams({
      limit: "20",
      offset: String(offset),
      sort: applied.sort,
      order: applied.order,
    });
    for (const [key, value] of Object.entries(applied))
      if (value && !["sort", "order", "period"].includes(key)) query.set(key, value);
    const range = expensePeriodRange(applied.period);
    if (range) {
      query.set("from", range.from);
      query.set("to", range.to);
    }
    try {
      setPage(await api<ExpensePage>(`/expenses?${query}`));
    } catch (error) {
      setFailure(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [api, applied, offset]);
  // Loading is intentionally tied to the applied filters and page offset.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  useEffect(() => {
    if (deleting) dialog.current?.showModal();
    else dialog.current?.close();
  }, [deleting]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget),
      receipt = data.get("receipt");
    setBusy(true);
    setFailure("");
    try {
      const payload = {
        title: String(data.get("title")),
        description: String(data.get("description")),
        amount: String(data.get("amount")),
        category: String(data.get("category")),
        date: String(data.get("date")),
        vendor: String(data.get("vendor")),
        notes: String(data.get("notes")),
        ...(editing ? { expectedVersion: editing.version } : {}),
      };
      const invalid =
        validateExpense(payload) ||
        (receipt instanceof File && receipt.size ? validateReceiptFile(receipt) : "");
      if (invalid) throw new Error(invalid);
      const saved = await api<Expense>(editing ? `/expenses/${editing.id}` : "/expenses", {
        method: editing ? "PATCH" : "POST",
        body: payload,
      });
      if (receipt instanceof File && receipt.size) {
        const upload = new FormData();
        upload.set("receipt", receipt);
        await api(`/expenses/${saved.id}/receipt`, { method: "PUT", body: upload });
      }
      setEditing(null);
      setCreating(false);
      setSelected(null);
      onSaved(editing ? "Expense updated." : "Expense added.");
      await load();
    } catch (error) {
      setFailure(errorMessage(error));
      onError(error);
    } finally {
      setBusy(false);
    }
  }
  async function openReceipt(expense: Expense, download = false) {
    setBusy(true);
    try {
      const blob = await api<Blob>(`/expenses/${expense.id}/receipt`, { responseType: "file" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      if (download) link.download = expense.receiptName ?? "receipt";
      else {
        link.target = "_blank";
        link.rel = "noopener";
      }
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      onError(error);
    } finally {
      setBusy(false);
    }
  }
  async function removeReceipt(expense: Expense) {
    setBusy(true);
    try {
      await api(`/expenses/${expense.id}/receipt`, { method: "DELETE" });
      onSaved("Receipt removed.");
      setEditing(null);
      await load();
    } catch (error) {
      onError(error);
    } finally {
      setBusy(false);
    }
  }
  async function removeExpense() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api(`/expenses/${deleting.id}`, { method: "DELETE" });
      setDeleting(null);
      onSaved("Expense deleted.");
      await load();
    } catch (error) {
      setFailure(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  async function openDetails(expense: Expense) {
    if (selected?.id === expense.id) {
      setSelected(null);
      return;
    }
    setBusy(true);
    try {
      setSelected(await api<Expense>(`/expenses/${expense.id}`));
    } catch (error) {
      onError(error);
    } finally {
      setBusy(false);
    }
  }
  async function runWorkflow() {
    if (!workflow) return;
    setBusy(true);
    setFailure("");
    try {
      const body =
        workflow.action === "reject"
          ? { expectedVersion: workflow.expense.version, reason: rejectionReason }
          : { expectedVersion: workflow.expense.version };
      await api(`/expenses/${workflow.expense.id}/${workflow.action}`, { method: "POST", body });
      onSaved(
        workflow.action === "submit"
          ? "Expense submitted for approval."
          : workflow.action === "approve"
            ? "Expense approved."
            : workflow.action === "reject"
              ? "Expense rejected."
              : "Expense reopened as a draft.",
      );
      setWorkflow(null);
      setRejectionReason("");
      setSelected(null);
      await load();
    } catch (error) {
      setFailure(errorMessage(error));
      onError(error);
    } finally {
      setBusy(false);
    }
  }
  const money = (value: string) => formatExpenseMoney(value, currency);
  return (
    <div className="expense-manager">
      <section className="panel expense-filters">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setOffset(0);
            setApplied(filters);
          }}
        >
          <label>
            Search
            <input
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Title, vendor or notes"
            />
          </label>
          <label>
            Category
            <Dropdown
              name="categoryFilter"
              label="Category"
              value={filters.category}
              onChange={(category) => setFilters({ ...filters, category })}
              searchable={false}
              options={[
                { value: "", label: "All categories" },
                ...EXPENSE_CATEGORIES.map((value) => ({ value, label: value })),
              ]}
            />
          </label>
          <label>
            Status
            <Dropdown
              name="statusFilter"
              label="Status"
              value={filters.approvalStatus}
              onChange={(approvalStatus) => setFilters({ ...filters, approvalStatus })}
              searchable={false}
              options={[
                { value: "", label: "All statuses" },
                { value: "DRAFT", label: "Draft" },
                { value: "PENDING_APPROVAL", label: "Pending approval" },
                { value: "APPROVED", label: "Approved" },
                { value: "REJECTED", label: "Rejected" },
              ]}
            />
          </label>
          <label>
            Period
            <Dropdown
              name="periodFilter"
              label="Period"
              value={filters.period}
              onChange={(period) => setFilters({ ...filters, period })}
              searchable={false}
              options={[
                { value: "", label: "All time" },
                { value: "last7", label: "Last 7 days" },
                { value: "last30", label: "Last 30 days" },
                { value: "thisMonth", label: "This month" },
                { value: "lastMonth", label: "Last month" },
                { value: "thisYear", label: "This year" },
              ]}
            />
          </label>
          <label>
            Sort
            <Dropdown
              name="sortFilter"
              label="Sort"
              value={`${filters.sort}:${filters.order}`}
              onChange={(value) => {
                const [sort, order] = value.split(":");
                setFilters({ ...filters, sort: sort!, order: order! });
              }}
              searchable={false}
              options={[
                { value: "date:desc", label: "Newest expense" },
                { value: "date:asc", label: "Oldest expense" },
                { value: "amount:desc", label: "Highest amount" },
                { value: "amount:asc", label: "Lowest amount" },
                { value: "title:asc", label: "Title A–Z" },
              ]}
            />
          </label>
          <button className="button secondary" type="submit">
            Apply filters
          </button>
          {canCreate && (
            <button
              className="button primary"
              type="button"
              onClick={() => {
                setEditing(null);
                setCreating(true);
              }}
            >
              + Create Expense
            </button>
          )}
        </form>
      </section>
      {(creating || editing) && (
        <FormModal
          title={editing ? "Edit expense" : "Create expense"}
          onClose={() => {
            if (!busy) {
              setCreating(false);
              setEditing(null);
            }
          }}
        >
          <ExpenseForm
            expense={editing}
            busy={busy}
            onSubmit={save}
            onCancel={() => {
              setCreating(false);
              setEditing(null);
            }}
            onRemoveReceipt={
              canUpdate && editing?.receiptName ? () => void removeReceipt(editing) : undefined
            }
          />
        </FormModal>
      )}
      {failure && (
        <p className="alert" role="alert">
          {failure}
        </p>
      )}
      <section className="panel" data-tour="expense-list">
        <div className="panel-heading">
          <h3>
            {applied.approvalStatus === "PENDING_APPROVAL" ? "Pending approvals" : "Your expenses"}
          </h3>
          <span className="expense-heading-meta">
            <span className="muted">{page.total} total</span>
            {canApprove && page.pendingCount > 0 && (
              <button
                className="text-button"
                onClick={() => {
                  const next = { ...filters, approvalStatus: "PENDING_APPROVAL" };
                  setFilters(next);
                  setApplied(next);
                  setOffset(0);
                }}
              >
                {page.pendingCount} pending
              </button>
            )}
          </span>
        </div>
        {loading ? (
          <div className="loading" role="status">
            <span className="spinner" />
            Loading expenses…
          </div>
        ) : page.items.length === 0 ? (
          <div className="empty-state">
            <span className="empty-symbol">▤</span>
            <h3>No expenses found</h3>
            <p>
              {canCreate
                ? "Create an expense or adjust your filters."
                : "No matching expenses are available."}
            </p>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Expense</th>
                  <th>Status</th>
                  <th>Category</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {page.items.map((expense) => (
                  <tr key={expense.id}>
                    <td>
                      <strong>{expense.title}</strong>
                      <small>{expense.submittedBy?.fullName ?? expense.vendor ?? "—"}</small>
                    </td>
                    <td>
                      <span className={`expense-status ${expense.approvalStatus.toLowerCase()}`}>
                        {expense.approvalStatus.replaceAll("_", " ").toLowerCase()}
                      </span>
                    </td>
                    <td>
                      <span className="role-badge">{expense.category.toLowerCase()}</span>
                    </td>
                    <td>{expense.date.slice(0, 10)}</td>
                    <td>
                      <strong>{money(expense.amount)}</strong>
                    </td>
                    <td>
                      <div className="client-row-actions">
                        <button className="text-button" onClick={() => void openDetails(expense)}>
                          View
                        </button>
                        {expense.receiptName && (
                          <button
                            className="text-button"
                            disabled={busy}
                            onClick={() => void openReceipt(expense)}
                          >
                            Receipt
                          </button>
                        )}
                        {canSubmit && expense.approvalStatus === "DRAFT" && (
                          <button
                            className="text-button"
                            disabled={busy}
                            onClick={() => setWorkflow({ expense, action: "submit" })}
                          >
                            Submit
                          </button>
                        )}
                        {canApprove && expense.approvalStatus === "PENDING_APPROVAL" && (
                          <>
                            <button
                              className="text-button"
                              disabled={busy}
                              onClick={() => setWorkflow({ expense, action: "approve" })}
                            >
                              Approve
                            </button>
                            <button
                              className="text-button danger-text"
                              disabled={busy}
                              onClick={() => setWorkflow({ expense, action: "reject" })}
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {canSubmit && expense.approvalStatus === "REJECTED" && (
                          <button
                            className="text-button"
                            disabled={busy}
                            onClick={() => setWorkflow({ expense, action: "reopen" })}
                          >
                            Revise
                          </button>
                        )}
                        {canUpdate && expense.approvalStatus === "DRAFT" && (
                          <button
                            className="text-button"
                            disabled={busy}
                            onClick={() => {
                              setCreating(false);
                              setEditing(expense);
                            }}
                          >
                            Edit
                          </button>
                        )}
                        {canDelete && expense.approvalStatus === "DRAFT" && (
                          <button
                            className="text-button danger-text"
                            disabled={busy}
                            onClick={() => setDeleting(expense)}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {selected && (
        <section className="panel expense-details">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Expense details</span>
              <h3>{selected.title}</h3>
            </div>
            <button
              className="text-button"
              onClick={() => setSelected(null)}
              aria-label="Close expense details"
            >
              ×
            </button>
          </div>
          <dl>
            <dt>Status</dt>
            <dd>
              <span className={`expense-status ${selected.approvalStatus.toLowerCase()}`}>
                {selected.approvalStatus.replaceAll("_", " ").toLowerCase()}
              </span>
            </dd>
            <dt>Amount</dt>
            <dd>{money(selected.amount)}</dd>
            <dt>Date</dt>
            <dd>{selected.date.slice(0, 10)}</dd>
            <dt>Category</dt>
            <dd>{selected.category.toLowerCase()}</dd>
            <dt>Vendor</dt>
            <dd>{selected.vendor || "—"}</dd>
            <dt>Description</dt>
            <dd>{selected.description || "—"}</dd>
            <dt>Notes</dt>
            <dd>{selected.notes || "—"}</dd>
            <dt>Submitted by</dt>
            <dd>{selected.submittedBy?.fullName ?? "—"}</dd>
            <dt>Submitted</dt>
            <dd>{selected.submittedAt ? new Date(selected.submittedAt).toLocaleString() : "—"}</dd>
            <dt>Reviewed by</dt>
            <dd>{selected.reviewedBy?.fullName ?? "—"}</dd>
            <dt>Reviewed</dt>
            <dd>{selected.reviewedAt ? new Date(selected.reviewedAt).toLocaleString() : "—"}</dd>
            {selected.rejectionReason && (
              <>
                <dt>Rejection reason</dt>
                <dd className="expense-rejection">{selected.rejectionReason}</dd>
              </>
            )}
            <dt>Receipt</dt>
            <dd>
              {selected.receiptName ? (
                <span className="receipt-actions">
                  <button className="text-button" onClick={() => void openReceipt(selected)}>
                    Preview
                  </button>
                  <button className="text-button" onClick={() => void openReceipt(selected, true)}>
                    Download
                  </button>
                </span>
              ) : (
                "None"
              )}
            </dd>
          </dl>
          {selected.approvalHistory && selected.approvalHistory.length > 0 && (
            <div className="expense-history">
              <h4>Approval history</h4>
              <ol>
                {selected.approvalHistory.map((event) => (
                  <li key={event.id}>
                    <span />
                    <div>
                      <strong>{event.action.replaceAll("_", " ").toLowerCase()}</strong>
                      <small>
                        {event.actor?.fullName ?? "Former member"} ·{" "}
                        {new Date(event.createdAt).toLocaleString()}
                      </small>
                      {event.rejectionReason && <p>{event.rejectionReason}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>
      )}
      {workflow && (
        <AppModal
          title={
            workflow.action === "reject"
              ? "Reject expense"
              : workflow.action === "approve"
                ? "Approve expense"
                : workflow.action === "reopen"
                  ? "Revise expense"
                  : "Submit expense"
          }
          onClose={() => {
            if (!busy) {
              setWorkflow(null);
              setRejectionReason("");
            }
          }}
        >
          <div className="expense-workflow-dialog">
            <p>
              {workflow.action === "submit"
                ? "Send this expense for review? It cannot be edited while pending."
                : workflow.action === "approve"
                  ? "Approve this expense for financial reporting?"
                  : workflow.action === "reopen"
                    ? "Reopen this rejected expense as an editable draft?"
                    : "Explain what needs to be corrected."}
            </p>
            {workflow.action === "reject" && (
              <label>
                Reason
                <textarea
                  autoFocus
                  required
                  maxLength={1000}
                  value={rejectionReason}
                  onChange={(event) => setRejectionReason(event.target.value)}
                />
              </label>
            )}
            <div className="invoice-actions">
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => setWorkflow(null)}
              >
                Cancel
              </button>
              <button
                className={workflow.action === "reject" ? "button danger" : "button primary"}
                disabled={busy || (workflow.action === "reject" && !rejectionReason.trim())}
                onClick={() => void runWorkflow()}
              >
                {busy ? "Saving…" : "Confirm"}
              </button>
            </div>
          </div>
        </AppModal>
      )}
      <div className="pagination">
        <span>
          {page.total
            ? `Showing ${page.offset + 1}–${Math.min(page.offset + page.items.length, page.total)} of ${page.total}`
            : "No records"}
        </span>
        <div>
          <button
            className="button secondary compact"
            disabled={offset === 0 || loading}
            onClick={() => setOffset(Math.max(0, offset - 20))}
          >
            ← Previous
          </button>
          <button
            className="button secondary compact"
            disabled={offset + page.items.length >= page.total || loading}
            onClick={() => setOffset(offset + 20)}
          >
            Next →
          </button>
        </div>
      </div>
      <dialog
        ref={dialog}
        className="invoice-delete-dialog"
        onCancel={(e) => {
          e.preventDefault();
          if (!busy) setDeleting(null);
        }}
        onClose={() => setDeleting(null)}
      >
        <h2>Delete expense?</h2>
        <p>
          <strong>{deleting?.title}</strong>
        </p>
        <p>This permanently deletes the expense and its receipt.</p>
        <div className="invoice-actions">
          <button
            autoFocus
            className="button secondary"
            disabled={busy}
            onClick={() => setDeleting(null)}
          >
            Cancel
          </button>
          <button className="button danger" disabled={busy} onClick={() => void removeExpense()}>
            {busy ? "Deleting…" : "Delete permanently"}
          </button>
        </div>
      </dialog>
    </div>
  );
}
