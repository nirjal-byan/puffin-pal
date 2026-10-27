export type AccountsPayableApi = <T>(
  path: string,
  options?: { method?: string; body?: unknown; signal?: AbortSignal },
) => Promise<T>;

export interface Vendor {
  id: string;
  name: string;
  displayName: string | null;
  email: string | null;
  defaultCurrency: string;
  paymentTermsDays: number;
  active: boolean;
  version: number;
}

export interface VendorBill {
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

export interface PayablesSummary {
  outstanding: string;
  overdue: string;
  aging: Record<string, string>;
}

export type PayablesView = "vendors" | "bills";
export type PayablesModal = "vendor" | "bill" | "payment" | null;
