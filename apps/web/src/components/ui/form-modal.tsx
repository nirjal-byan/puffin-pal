"use client";

import type { FormEvent, ReactNode } from "react";
import { AppModal } from "@/components/ui/app-modal";

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

export function FormField({
  label,
  optional = false,
  hint,
  wide = false,
  children,
}: {
  label: string;
  optional?: boolean;
  hint?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={`form-field${wide ? " standard-form-grid-wide" : ""}`}>
      <span className="form-field-label">
        <span>{label}</span>
        {optional && <small>Optional</small>}
      </span>
      {children}
      {hint && <span className="form-field-hint">{hint}</span>}
    </label>
  );
}

export function FormCheckbox({
  checked,
  onChange,
  label,
  description,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label className="form-checkbox">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        <strong>{label}</strong>
        {description && <small>{description}</small>}
      </span>
    </label>
  );
}

export function FormFilePicker({
  accept,
  fileName,
  title = "Choose a file",
  hint,
  onChange,
}: {
  accept?: string;
  fileName?: string;
  title?: string;
  hint?: string;
  onChange: (file: File | null) => void | Promise<void>;
}) {
  return (
    <label className="form-file-picker">
      <input
        type="file"
        accept={accept}
        onChange={(event) => void onChange(event.target.files?.[0] ?? null)}
      />
      <span className="form-file-picker-icon" aria-hidden="true">
        ⇧
      </span>
      <span className="form-file-picker-copy">
        <strong>{fileName || title}</strong>
        {hint && <small>{hint}</small>}
      </span>
      <span className="button secondary compact">Browse</span>
    </label>
  );
}
