import type { ReactNode } from "react";
import { AppModal } from "@/components/ui/app-modal";

export function ConfirmationModal({
  title,
  message,
  confirmLabel,
  danger = false,
  isSaving,
  onConfirm,
  onClose,
  children,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  isSaving: boolean;
  onConfirm: () => void;
  onClose: () => void;
  children?: ReactNode;
}) {
  return (
    <AppModal title={title} onClose={onClose}>
      <div className="confirmation-content">
        <p>{message}</p>
        {children}
        <div className="modal-form-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={`button ${danger ? "danger" : "primary"}`}
            disabled={isSaving}
            onClick={onConfirm}
          >
            {isSaving ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </AppModal>
  );
}
