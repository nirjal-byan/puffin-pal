import { useEffect, useRef } from "react";
import type { Expense } from "../types";

export function DeleteExpenseDialog({
  expense,
  busy,
  onClose,
  onConfirm,
}: {
  expense: Expense | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (expense) dialog.current?.showModal();
    else dialog.current?.close();
  }, [expense]);
  return (
    <dialog
      ref={dialog}
      className="invoice-delete-dialog"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClose={onClose}
    >
      <h2>Delete expense?</h2>
      <p>
        <strong>{expense?.title}</strong>
      </p>
      <p>This permanently deletes the expense and its receipt.</p>
      <div className="invoice-actions">
        <button autoFocus className="button secondary" disabled={busy} onClick={onClose}>
          Cancel
        </button>
        <button className="button danger" disabled={busy} onClick={onConfirm}>
          {busy ? "Deleting…" : "Delete permanently"}
        </button>
      </div>
    </dialog>
  );
}
