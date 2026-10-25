"use client";

import { useEffect } from "react";

export function Snackbar({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const timeout = window.setTimeout(onDismiss, 4000);
    return () => window.clearTimeout(timeout);
  }, [onDismiss]);

  return (
    <div className="snackbar" role="status" aria-live="polite">
      <span className="snackbar-icon" aria-hidden="true">
        ✓
      </span>
      <span>{message}</span>
      <button type="button" aria-label="Dismiss notification" onClick={onDismiss}>
        ×
      </button>
    </div>
  );
}
