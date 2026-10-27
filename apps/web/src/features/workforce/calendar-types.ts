export type WorkforceSettings = { timezone: string; unpaidLeaveDeductionsEnabled: boolean };

export interface WorkforceCalendarData {
  timezone: string;
  employees: Array<{ id: string; name: string }>;
  attendance: Array<{ id: string; employeeId: string; workDate: string; status: string }>;
  leave: Array<{
    id: string;
    employeeId: string;
    startDate: string;
    endDate: string;
    status: string;
  }>;
  overtime: Array<{ id: string; employeeId: string; workDate: string }>;
  holidays: Array<{
    id: string;
    name: string;
    date: string;
    isRecurring: boolean;
    durationMinutes?: number;
    version: number;
  }>;
  schedules: Array<{
    id: string;
    employeeId: string;
    name: string;
    timezone: string;
    workdays: string;
    scheduledStartTime: string;
    scheduledEndTime: string;
    expectedDailyMinutes: number;
    breakMinutes: number;
    isActive: boolean;
    effectiveFrom: string;
    effectiveTo?: string;
    version: number;
  }>;
}
