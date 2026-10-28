"use client";
import type { Permission } from "@puffinpal/permissions";
import { useState, type FormEvent } from "react";
import { errorMessage, type WorkspaceApi } from "@/lib/api";
import { validateExpense, validateReceiptFile } from "../../expenses/schemas/expense.schema";
import { FormModal } from "@/components/ui/form-modal";
import type { Expense } from "../../expenses/types";
import { formatExpenseMoney } from "../../expenses/utils";
import { ExpenseDetails } from "./expense-details";
import { ExpenseFilters } from "./expense-filters";
import { ExpenseForm } from "./expense-form";
import { ExpenseWorkflowDialog, type ExpenseWorkflow } from "./expense-workflow-dialog";
import { ExpensesTable } from "./expenses-table";
import { DeleteExpenseDialog } from "./delete-expense-dialog";
import { useExpenseCollection } from "../hooks/use-expense-collection";
import { ExpensePagination } from "./expense-pagination";

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
  const {
    page,
    offset,
    setOffset,
    filters,
    setFilters,
    applied,
    loading,
    failure,
    setFailure,
    load,
    applyFilters,
    showPending,
  } = useExpenseCollection(api);
  const [editing, setEditing] = useState<Expense | null>(null),
    [creating, setCreating] = useState(false),
    [deleting, setDeleting] = useState<Expense | null>(null);
  const [selected, setSelected] = useState<Expense | null>(null);
  const [workflow, setWorkflow] = useState<ExpenseWorkflow | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [busy, setBusy] = useState(false);
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
        onApply={applyFilters}
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
        onPending={showPending}
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
      <ExpensePagination page={page} offset={offset} loading={loading} onOffsetChange={setOffset} />
      <DeleteExpenseDialog
        expense={deleting}
        busy={busy}
        onClose={() => setDeleting(null)}
        onConfirm={() => void removeExpense()}
      />
    </div>
  );
}
