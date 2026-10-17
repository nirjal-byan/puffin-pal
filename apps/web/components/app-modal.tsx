"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export function AppModal({
  title,
  children,
  onClose,
  wide = false,
  badge,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  badge?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [closing, setClosing] = useState(false);

  function requestClose() {
    if (closing) return;
    setClosing(true);
    closeTimer.current = setTimeout(onClose, 160);
  }

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      if (element?.open) element.close();
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      className={`app-modal${wide ? " app-modal-wide" : ""}${closing ? " is-closing" : ""}`}
      aria-labelledby="app-modal-title"
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <header className="app-modal-header">
        <div className="app-modal-title">
          <h2 id="app-modal-title">{title}</h2>
          {badge && <span className="role-badge">{badge}</span>}
        </div>
        <button
          type="button"
          className="app-modal-close"
          onClick={requestClose}
          aria-label={`Close ${title}`}
        >
          <span aria-hidden="true">×</span>
        </button>
      </header>
      <div className="app-modal-body">{children}</div>
    </dialog>
  );
}
