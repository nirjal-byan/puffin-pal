export type AccountsPayableApi = <T>(
  path: string,
  options?: {
    method?: string;
    body?: unknown;
    signal?: AbortSignal;
    responseType?: "blob" | "file";
  },
) => Promise<T>;

export interface Vendor {
  id: string;
  name: string;
  displayName: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  country: string | null;
  taxId: string | null;
  notes: string | null;
  email: string | null;
  defaultCurrency: string;
  paymentTermsDays: number;
  active: boolean;
  version: number;
}

export interface VendorBill {
  vendorName?: string;
  id: string;
  vendorId: string;
  billNumber: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  totalAmount: string;
  paidAmount: string;
  balance: string;
  status: string;
  settlementStatus: string;
  version: number;
  overdue: boolean;
}

export interface BillItem {
  description: string;
  quantity: string;
  unitPrice: string;
  taxAmount: string;
  discountAmount: string;
}
export type BillTransition = "submit" | "approve" | "reject" | "resubmit" | "void";
export interface PayablePayment {
  id: string;
  vendorBillId: string | null;
  expenseId?: string | null;
  targetType: "VENDOR_BILL" | "EXPENSE";
  amount: string;
  currency: string;
  paymentDate: string;
  method: string;
  reference: string | null;
  notes: string | null;
  recordedById: string;
  createdAt: string;
  reversedAt: string | null;
  reversedById: string | null;
  reversalReason: string | null;
  version: number;
}
export interface PayableAuditEvent {
  id: string;
  action: string;
  actorId: string;
  createdAt: string;
  details: string | null;
}
export interface VendorBillDetail extends VendorBill {
  rejectionReason: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  voidedAt: string | null;
  audit: PayableAuditEvent[];
  vendor: Vendor;
  expenseId: string | null;
  vendorReference: string | null;
  description: string | null;
  items: (BillItem & { position: number })[];
  attachmentName: string | null;
  attachmentMime: string | null;
  attachmentSize: number | null;
}
export interface PayablesSummary {
  outstanding: string;
  overdue: string;
  aging: Record<string, string>;
}

export type PayablesView = "vendors" | "bills";
export type PayablesModal = "vendor" | "bill" | "payment" | null;
export interface VendorFormValue {
  name: string;
  displayName: string;
  phone: string;
  website: string;
  address: string;
  country: string;
  taxId: string;
  notes: string;
  email: string;
  defaultCurrency: string;
  paymentTermsDays: number;
}
export interface BillFormValue {
  vendorId: string;
  billNumber: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  description: string;
  vendorReference: string;
  expenseId: string;
  items: BillItem[];
}
export interface VendorPaymentFormValue {
  amount: string;
  paymentDate: string;
  method: string;
  reference: string;
}
