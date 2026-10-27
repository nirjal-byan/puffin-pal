export interface PayrollRun {
  id: string;
  name: string;
  periodStart: string;
  periodEnd: string;
  paymentDate: string;
  status: "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "FINALIZED";
  currency: string;
  totalGross: string;
  totalDeductions: string;
  totalNet: string;
  employeeCount: number;
  version: number;
  payrollScheduleId?: string | null;
}

export interface PayrollEntry {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  jobTitle: string;
  grossPay: string;
  totalDeductions: string;
  netPay: string;
  paidAmount: string;
  outstandingAmount: string;
  paymentStatus: string;
  payslipStatus: string;
  payments: Array<{ id: string; amount: string; paymentDate: string; reference: string }>;
}

export type PayrollDetails = PayrollRun & { entries: PayrollEntry[] };

export interface WorkforceReview {
  employeeId: string;
  employeeName: string;
  recordedAttendanceDays: number;
  workedMinutes: number;
  scheduledWorkdays: number;
  missingAttendanceRecords: number;
  approvedPaidLeaveUnits: number;
  approvedUnpaidLeaveUnits: number;
  unresolvedLeaveRequests: number;
  unresolvedOvertimeRequests: number;
  approvedOvertime: Array<{ id: string; minutes?: number; rate?: string; imported: boolean }>;
  unpaidLeaveDeductionsEnabled: boolean;
  approvedUnpaidLeave: Array<{
    id: string;
    startDate: string;
    endDate: string;
    minutes?: number;
    imported: boolean;
  }>;
}

export interface PayrollEmployeeOption {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  status: string;
}
