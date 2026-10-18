"use client";
import { useEffect, useRef, useState } from "react";
import type { WorkspaceApi } from "../../../lib/api";
import { errorMessage } from "../../../lib/api";
import { createInvoiceExport, downloadInvoiceExport, getInvoiceExport } from "../api/invoices";
import type { InvoiceExportStatus } from "../types/invoice.types";

export function InvoiceBulkExport({
  api,
  invoiceIds,
  onComplete,
}: {
  api: WorkspaceApi;
  invoiceIds: string[];
  onComplete: () => void;
}) {
  const [job, setJob] = useState<InvoiceExportStatus | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  async function poll(jobId: string) {
    while (mounted.current) {
      const next = await getInvoiceExport(api, jobId);
      if (!mounted.current) return;
      setJob(next);
      if (["COMPLETED", "FAILED", "EXPIRED"].includes(next.status)) return;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  async function start() {
    setBusy(true);
    setError("");
    try {
      const created = await createInvoiceExport(api, invoiceIds);
      setJob(created);
      await poll(created.jobId);
    } catch (failure) {
      if (mounted.current) setError(errorMessage(failure));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  async function download() {
    if (!job) return;
    setBusy(true);
    setError("");
    try {
      const blob = await downloadInvoiceExport(api, job.jobId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = job.filename ?? `invoice-export-${job.jobId}.zip`;
      link.click();
      URL.revokeObjectURL(url);
      onComplete();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="invoice-export-controls">
      <button
        className="button secondary"
        type="button"
        disabled={busy || invoiceIds.length === 0}
        onClick={job?.status === "COMPLETED" ? download : start}
      >
        {busy && job
          ? `Exporting ${job.progress}%…`
          : busy
            ? "Starting export…"
            : job?.status === "COMPLETED"
              ? "Download ZIP"
              : `Export selected (${invoiceIds.length})`}
      </button>
      {job && ["QUEUED", "PROCESSING"].includes(job.status) && (
        <span className="muted" role="status">
          {job.status === "QUEUED" ? "Queued…" : `${job.progress}% complete`}
        </span>
      )}
      {job?.status === "FAILED" && (
        <span className="invoice-field-error" role="alert">
          Export failed. Try again.
        </span>
      )}
      {job?.status === "EXPIRED" && (
        <span className="invoice-field-error" role="alert">
          This export has expired.
        </span>
      )}
      {error && (
        <span className="invoice-field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
