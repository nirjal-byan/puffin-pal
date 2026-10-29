import type { WorkspaceApi } from "@/lib/api";
import type {
  AttendanceRecord,
  AttendanceSummary,
  EmployeeOption,
  LeaveBalance,
  LeaveRequest,
  LeaveType,
  OvertimeRequest,
} from "../types";

export async function loadEmployees(api: WorkspaceApi) {
  const result = await api<{ items: EmployeeOption[] }>("/employees?limit=100&offset=0");
  return result.items;
}
export function loadAttendance(api: WorkspaceApi) {
  return api<AttendanceRecord[]>("/attendance");
}
export function loadAttendanceSummary(api: WorkspaceApi) {
  return api<AttendanceSummary>("/attendance/summary");
}
export function loadLeave(api: WorkspaceApi) {
  return Promise.all([
    api<LeaveType[]>("/leave/types"),
    api<LeaveRequest[]>("/leave/requests"),
    api<LeaveBalance[]>("/leave/balances"),
  ]);
}
export function loadOvertime(api: WorkspaceApi) {
  return api<OvertimeRequest[]>("/overtime");
}
