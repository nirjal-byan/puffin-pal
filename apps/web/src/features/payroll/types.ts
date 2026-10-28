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

export interface StatutoryRuleSet {
  id: string;
  name: string;
  version: number;
  status: string;
}

export interface StatutoryJurisdiction {
  id: string;
  countryCode: string;
  currency: string;
}

export interface StatutoryPreview {
  previewHash: string;
  results: Array<{
    entryId: string;
    employeeName: string;
    taxWithholding?: string;
    employeeContributions?: string;
    employerContributions?: string;
    netPay?: string;
    missingClassifications: string[];
  }>;
}

export interface StatutoryReport {
  finalizedPayrollRuns: number;
  taxWithholding: string;
  employeeContributions: string;
  employerContributions: string;
  netPay: string;
  totalEmployerCost: string;
  disclaimer: string;
}

export interface StatutoryFormState {
  countryCode: string;
  subdivisionCode: string;
  currency: string;
  mandatoryCalculation: boolean;
  name: string;
  effectiveFrom: string;
  periodsPerYear: number;
  taxMethod: "FLAT" | "PROGRESSIVE";
  flatRate: string;
  bracketThreshold: string;
  lowerBracketRate: string;
  upperBracketRate: string;
  employeeRate: string;
  employerRate: string;
}

export interface PayrollSchedule {
  id: string;
  name: string;
  frequency: "WEEKLY" | "BIWEEKLY" | "SEMIMONTHLY" | "MONTHLY";
  timezone: string;
  startDate: string;
  generationTime: string;
  paymentOffsetDays: number | null;
  status: "ACTIVE" | "PAUSED";
  lastSuccessfulAt: string | null;
  nextRunAt: string;
  version: number;
}

export interface PayrollScheduleOccurrence {
  id: string;
  payrollRunId: string | null;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  source: "SCHEDULED" | "MANUAL";
  status: string;
  attempts: number;
  failureMessage: string | null;
}

export interface PayrollNotification {
  id: string;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
}

export interface PayrollScheduleFormState {
  name: string;
  frequency: PayrollSchedule["frequency"];
  timezone: string;
  startDate: string;
  generationTime: string;
  paymentOffsetDays: string;
}
