"use client";

import type { FormEvent, ReactNode } from "react";
import { AppModal } from "./app-modal";

export function FormModal({
  title,
  badge,
  onClose,
  onSubmit,
  submitLabel,
  submittingLabel = "Saving…",
  submitting = false,
  submitDisabled = false,
  children,
  wide = false,
}: {
  title: string;
  badge?: string;
  onClose: () => void;
  onSubmit?: () => void | Promise<void>;
  submitLabel?: string;
  submittingLabel?: string;
  submitting?: boolean;
  submitDisabled?: boolean;
  children: ReactNode;
  wide?: boolean;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSubmit?.();
  }

  const content = <div className="standard-form-modal-content">{children}</div>;
  return (
    <AppModal title={title} badge={badge} onClose={onClose} wide={wide}>
      {onSubmit && submitLabel ? (
        <form className="standard-form-modal" onSubmit={submit}>
          {content}
          <footer className="standard-form-modal-actions">
            <button type="button" className="button secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="button primary" disabled={submitting || submitDisabled}>
              {submitting ? submittingLabel : submitLabel}
            </button>
          </footer>
        </form>
      ) : (
        <div className="standard-form-modal standard-form-modal-unmanaged">{content}</div>
      )}
    </AppModal>
  );
}

export function FormModalIntro({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="standard-form-intro">
      <span aria-hidden="true">{icon}</span>
      <div>
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
    </div>
  );
}

export function FormModalSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="standard-form-section">
      <header>
        <strong>{title}</strong>
        {description && <span>{description}</span>}
      </header>
      {children}
    </section>
  );
}
