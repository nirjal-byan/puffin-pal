import type { WorkspaceApi } from "../../../lib/api";
import type { InvoiceDetail, RecordPaymentPayload } from "../types/invoice.types";
import type { InvoiceExportStatus } from "../types/invoice.types";

export function createInvoiceExport(api: WorkspaceApi, invoiceIds: string[]) {
  return api<InvoiceExportStatus>("/invoices/exports", {
    method: "POST",
    body: { requestId: crypto.randomUUID(), invoiceIds },
  });
}
export function getInvoiceExport(api: WorkspaceApi, jobId: string, signal?: AbortSignal) {
  return api<InvoiceExportStatus>(`/invoices/exports/${jobId}`, { signal });
}
export function downloadInvoiceExport(api: WorkspaceApi, jobId: string) {
  return api<Blob>(`/invoices/exports/${jobId}/download`, { responseType: "file" });
}

export async function recordInvoicePayment(api: WorkspaceApi, id: string, input: RecordPaymentPayload) {
  const invoice = await api<InvoiceDetail>(`/invoices/${id}/payments`, { method: "POST", body: input });
  clearRecentInvoice();
  return invoice;
}
import type {
  CreateInvoicePayload,
  CreatedInvoice,
} from "../types/invoice.types";
export function downloadInvoicePdf(api: WorkspaceApi, id: string, signal?: AbortSignal) {
  return api<Blob>(`/invoices/${id}/pdf`, { responseType: "blob", signal });
}
export function createInvoice(api: WorkspaceApi, input: CreateInvoicePayload) {
  return api<CreatedInvoice>("/invoices", { method: "POST", body: input });
}
// The existing dashboard fetches lists on mount; this retained server result makes
// the saved draft visible even when UUID sorting places it on a later list page.
let recent: CreatedInvoice | null = null;
export function rememberCreatedInvoice(invoice: CreatedInvoice) {
  recent = invoice;
}
export function recentlyCreatedInvoice(organizationId: string) {
  return recent?.organizationId === organizationId ? recent : null;
}

export function clearRecentInvoice() {
  recent = null;
}
export function getInvoice(
  api: WorkspaceApi,
  id: string,
  signal?: AbortSignal,
) {
  return api<import("../types/invoice.types").InvoiceDetail>(
    `/invoices/${id}`,
    { signal },
  );
}
export async function updateInvoice(
  api: WorkspaceApi,
  id: string,
  input: CreateInvoicePayload,
  expectedVersion: number,
) {
  const invoice = await api<CreatedInvoice>(`/invoices/${id}`, {
    method: "PATCH",
    body: { ...input, expectedVersion },
  });
  clearRecentInvoice();
  return invoice;
}
export async function deleteInvoice(
  api: WorkspaceApi,
  id: string,
  expectedVersion: number,
) {
  const result = await api<{ message: string }>(`/invoices/${id}`, {
    method: "DELETE",
    body: { expectedVersion },
  });
  clearRecentInvoice();
  return result;
}

export async function issueInvoice(
  api: WorkspaceApi,
  id: string,
  expectedVersion: number,
) {
  const invoice = await api<import("../types/invoice.types").InvoiceDetail>(
    `/invoices/${id}/issue`,
    {
      method: "POST",
      body: { expectedVersion },
    },
  );
  clearRecentInvoice();
  return invoice;
}
