"use client";
import type { Permission } from "@puffinpal/permissions";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { errorMessage, type WorkspaceApi } from "@/lib/api";
import { validateExpense, validateReceiptFile } from "../../expenses/schemas/expense.schema";
import { FormModal } from "@/components/ui/form-modal";
import type { Expense, ExpensePage } from "../../expenses/types";
import { expensePeriodRange, formatExpenseMoney } from "../../expenses/utils";
import { ExpenseDetails } from "./expense-details";
import { ExpenseFilters, type ExpenseFiltersValue } from "./expense-filters";
import { ExpenseForm } from "./expense-form";
import { ExpenseWorkflowDialog, type ExpenseWorkflow } from "./expense-workflow-dialog";
import { ExpensesTable } from "./expenses-table";

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
  const [filters, setFilters] = useState<ExpenseFiltersValue>({
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
  const [workflow, setWorkflow] = useState<ExpenseWorkflow | null>(null);
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
      <ExpenseFilters
        value={filters}
        canCreate={canCreate}
        onChange={setFilters}
        onApply={() => {
          setOffset(0);
          setApplied(filters);
        }}
        onCreate={() => {
          setEditing(null);
          setCreating(true);
        }}
      />
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
      <ExpensesTable
        page={page}
        loading={loading}
        busy={busy}
        pendingOnly={applied.approvalStatus === "PENDING_APPROVAL"}
        permissions={{
          create: canCreate,
          update: canUpdate,
          delete: canDelete,
          submit: canSubmit,
          approve: canApprove,
        }}
        money={money}
        onPending={() => {
          const next = { ...filters, approvalStatus: "PENDING_APPROVAL" };
          setFilters(next);
          setApplied(next);
          setOffset(0);
        }}
        onDetails={(expense) => void openDetails(expense)}
        onReceipt={(expense) => void openReceipt(expense)}
        onWorkflow={(expense, action) => setWorkflow({ expense, action })}
        onEdit={(expense) => {
          setCreating(false);
          setEditing(expense);
        }}
        onDelete={setDeleting}
      />
      {selected && (
        <ExpenseDetails
          expense={selected}
          money={money}
          onClose={() => setSelected(null)}
          onReceipt={(expense, download) => void openReceipt(expense, download)}
        />
      )}
      {workflow && (
        <ExpenseWorkflowDialog
          workflow={workflow}
          reason={rejectionReason}
          busy={busy}
          onReasonChange={setRejectionReason}
          onClose={() => {
            if (!busy) {
              setWorkflow(null);
              setRejectionReason("");
            }
          }}
          onConfirm={() => void runWorkflow()}
        />
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
