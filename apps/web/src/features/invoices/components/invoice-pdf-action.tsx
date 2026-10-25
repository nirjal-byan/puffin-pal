"use client";
import { useEffect, useRef, useState } from "react";
import type { Permission } from "@puffinpal/permissions";
import { errorMessage, type WorkspaceApi } from "@/lib/api";
import { downloadInvoicePdf } from "../api/invoices";
import { canDownloadInvoicePdf } from "../schemas/invoice.schema";
import type { InvoiceDetail } from "../types/invoice.types";

export function InvoicePdfAction({
  invoice,
  api,
  permissions,
}: {
  invoice: InvoiceDetail;
  api: WorkspaceApi;
  permissions: readonly Permission[];
}) {
  const pending = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  useEffect(() => () => pending.current?.abort(), []);

  async function download() {
    if (pending.current) return;
    const abort = new AbortController();
    pending.current = abort;
    setBusy(true);
    setFailure("");
    try {
      const blob = await downloadInvoicePdf(api, invoice.id, abort.signal);
      if (abort.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      try {
        const link = document.createElement("a");
        link.href = url;
        link.download = `${invoice.invoiceNumber.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100) || "invoice"}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
      } finally {
        // Give the browser time to begin reading the download before releasing it.
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (error) {
      if (!abort.signal.aborted) setFailure(errorMessage(error));
    } finally {
      pending.current = null;
      if (!abort.signal.aborted) setBusy(false);
    }
  }
  if (!invoice.issuedAt || !canDownloadInvoicePdf(invoice.status, permissions)) return null;
  return (
    <div className="invoice-actions">
      <button
        type="button"
        className="button secondary"
        disabled={busy}
        aria-busy={busy}
        onClick={download}
      >
        {busy ? "Preparing PDF…" : "Download PDF"}
      </button>
      {failure && (
        <p className="alert" role="alert">
          {failure}
        </p>
      )}
    </div>
  );
}
