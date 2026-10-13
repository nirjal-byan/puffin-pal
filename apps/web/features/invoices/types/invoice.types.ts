import type { FinancialRecord, InvoiceItem } from "../../../lib/api";
export interface InvoiceLine {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
}
export interface InvoiceDraft {
  clientId: string;
  issueDate: string;
  dueDate: string;
  notes: string;
  items: InvoiceLine[];
}
export interface CreateInvoicePayload {
  clientId: string;
  issueDate: string;
  dueDate: string;
  notes?: string;
  items: { description: string; quantity: number; unitPrice: string }[];
}
export interface CreatedInvoice extends FinancialRecord {
  organizationId: string;
  invoiceNumber: string;
  status: "DRAFT";
  subtotal: string;
  tax: string;
  total: string;
  items: InvoiceItem[];
}

export interface InvoiceDetail extends Omit<CreatedInvoice, "status"> {
  payments: InvoicePayment[];
  totalPaid: string;
  outstandingBalance: string;
  displayStatus: string;
  isOverdue: boolean;
  legacyPaid: boolean;
  status: "DRAFT" | "ISSUED" | "PENDING" | "PAID" | "OVERDUE" | "CANCELLED";
  issuedAt: string | null;
  issuedByUserId: string | null;
  sellerName: string | null;
  currency: string | null;
  version: number;
  clientId: string;
  client: import("../../../lib/api").Client;
  issueDate: string;
  dueDate: string;
  notes: string | null;
  updatedAt: string;
}

export interface InvoicePayment {
  id: string;
  amount: string;
  paymentDate: string;
  method: "BANK_TRANSFER" | "CASH" | "CARD" | "CHEQUE" | "OTHER";
  reference: string | null;
  notes: string | null;
  createdAt: string;
}
export interface RecordPaymentPayload {
  amount: string;
  paymentDate: string;
  method: InvoicePayment["method"];
  reference?: string;
  notes?: string;
  expectedVersion: number;
}
