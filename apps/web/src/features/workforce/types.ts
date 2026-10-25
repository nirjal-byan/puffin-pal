export interface EmployeeOption {
  id: string;
  firstName: string;
  lastName: string;
  employeeCode: string;
}
export interface AttendanceRecord {
  id: string;
  employeeId: string;
  workDate: string;
  status: string;
  checkInAt?: string;
  checkOutAt?: string;
  workedMinutes?: number;
  isLate: boolean;
  notes?: string;
  version: number;
}
export interface AttendanceSummary {
  scheduledDays: number;
  presentDays: number;
  absentDays: number;
  halfDays: number;
  approvedLeaveDays: number;
  lateArrivals: number;
  workedMinutes: number;
  attendancePercentage: number;
  missingRecords: number;
}
export interface AttendanceCorrection {
  id: string;
  attendanceRecordId: string;
  employeeId: string;
  proposedStatus: string;
  proposedWorkedMinutes?: number;
  reason: string;
  reviewReason?: string;
  status: string;
  payrollImpact: boolean;
  version: number;
}
export interface LeaveType {
  id: string;
  name: string;
  code: string;
  isPaid: boolean;
  annualAllowanceUnits: number;
  isActive: boolean;
}
export interface LeaveRequest {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  dayPortion: string;
  requestedUnits: number;
  reason?: string;
  status: string;
  version: number;
}
export interface LeaveBalance {
  employeeId: string;
  leaveTypeId: string;
  leaveTypeName: string;
  allowanceUnits: number;
  availableMinutes: number;
  accruedMinutes: number;
  usedMinutes: number;
  pendingMinutes: number;
  carriedForwardMinutes: number;
  expiredMinutes: number;
}
export interface OvertimeRequest {
  id: string;
  employeeId: string;
  workDate: string;
  requestedMinutes: number;
  approvedMinutes?: number;
  reason: string;
  status: string;
  hourlyRate?: string;
  multiplier?: string;
  version: number;
}

export function shortDate(value: string) {
  return value.slice(0, 10);
}
export function employeeName(employees: EmployeeOption[], id: string) {
  const employee = employees.find((item) => item.id === id);
  return employee ? `${employee.firstName} ${employee.lastName}` : "Employee";
}
