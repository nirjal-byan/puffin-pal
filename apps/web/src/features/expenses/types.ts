export const EXPENSE_CATEGORIES = ["SOFTWARE", "HARDWARE", "TRAVEL", "MARKETING", "OTHER"] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type ApprovalStatus = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED";
export type ExpenseWorkflowAction = "submit" | "approve" | "reject" | "reopen";

export interface ExpensePerson {
  id: string;
  fullName: string;
}

export interface ApprovalEvent {
  id: string;
  action: string;
  previousStatus: ApprovalStatus;
  newStatus: ApprovalStatus;
  rejectionReason: string | null;
  createdAt: string;
  actor: ExpensePerson | null;
}

export interface Expense {
  settlement?: Pick<
    ExpenseSettlement,
    "linked" | "basis" | "currency" | "totalAmount" | "paidAmount" | "balance" | "settlementStatus"
  >;
  id: string;
  title: string;
  description: string | null;
  amount: string;
  category: ExpenseCategory;
  vendor: string | null;
  notes: string | null;
  receiptName: string | null;
  receiptMime: string | null;
  receiptSize: number | null;
  date: string;
  createdAt: string;
  updatedAt: string;
  approvalStatus: ApprovalStatus;
  version: number;
  submittedAt: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdBy: ExpensePerson | null;
  submittedBy: ExpensePerson | null;
  reviewedBy: ExpensePerson | null;
  approvalHistory?: ApprovalEvent[];
}

export interface ExpensePage {
  items: Expense[];
  total: number;
  pendingCount: number;
  limit: number;
  offset: number;
}

export interface ExpenseFilters {
  search: string;
  category: string;
  approvalStatus: string;
  period: string;
  sort: string;
  order: string;
}

export interface ExpenseSettlement {
  expenseId: string;
  approvalStatus: ApprovalStatus;
  expenseAmount: string;
  expenseCurrency: string;
  basis: "BILL" | "EXPENSE";
  currency: string;
  totalAmount: string;
  paidAmount: string;
  balance: string;
  settlementStatus: "UNPAID" | "PARTIALLY_PAID" | "PAID";
  linked: boolean;
  linkedBill: { id: string; billNumber: string; status: string } | null;
  payments: import("../accounts-payable/types").PayablePayment[];
  directPayments?: import("../accounts-payable/types").PayablePayment[];
}
export interface ExpenseSettlementInput {
  amount: string;
  paymentDate: string;
  method: string;
  reference: string;
}
