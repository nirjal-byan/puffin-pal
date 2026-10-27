export interface BankAccount {
  id: string;
  displayName: string;
  bankName: string;
  accountHolder: string;
  maskedIdentifier: string;
  currency: string;
  countryCode: string;
  isActive: boolean;
  isDefault: boolean;
  version: number;
}

export interface BankReconciliation {
  id: string;
  targetType: string;
  version: number;
}

export interface BankTransaction {
  id: string;
  bankAccountId: string;
  transactionDate: string;
  amount: string;
  currency: string;
  direction: "CREDIT" | "DEBIT";
  description: string;
  reference: string | null;
  reconciliation: BankReconciliation | null;
}

export interface BankImport {
  id: string;
  fileName: string;
  status: string;
  rowCount: number;
  importedCount: number;
  duplicateCount: number;
  createdAt: string;
}

export interface ReconciliationCandidate {
  targetType: "INVOICE_PAYMENT" | "PAYROLL_PAYMENT" | "PAYABLE_PAYMENT";
  targetId: string;
  amount: string;
  date: string;
  reference: string | null;
  label: string;
}

export interface PayrollObligation {
  id: string;
  payrollRunId: string;
  payrollRunName: string;
  employeeName: string;
  currency: string;
  amount: string;
  paymentDate: string;
}

export interface PaymentBatchItem {
  id: string;
  employeeName: string;
  amount: string;
  status: "PENDING" | "ATTEMPTED" | "PAID" | "FAILED";
}

export interface PaymentBatch {
  id: string;
  name: string;
  currency: string;
  totalAmount: string;
  status: string;
  version: number;
  items: PaymentBatchItem[];
}

export type BankingView = "transactions" | "accounts" | "imports" | "batches";
