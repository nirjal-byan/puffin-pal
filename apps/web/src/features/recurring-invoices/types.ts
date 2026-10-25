export interface RecurringItem {
  description: string;
  quantity: number;
  unitPrice: string;
}

export interface RecurringSchedule {
  id: string;
  name: string;
  description?: string | null;
  clientId: string;
  clientName?: string;
  amount?: string;
  currency?: string;
  frequency: string;
  interval: number;
  startDate: string;
  endDate?: string | null;
  nextRunAt: string;
  lastRunAt?: string | null;
  status: string;
  dueDateOffsetDays: number;
  autoIssue: boolean;
  version: number;
  items?: RecurringItem[];
}

export interface RecurringOccurrence {
  id: string;
  scheduledFor: string;
  status: string;
  invoiceId?: string | null;
  failureCode?: string | null;
}

export interface RecurringFormValues {
  name: string;
  description: string;
  clientId: string;
  frequency: string;
  interval: number;
  startDate: string;
  endDate: string;
  dueDateOffsetDays: number;
  autoIssue: boolean;
  items: RecurringItem[];
}

export function emptyRecurringForm(): RecurringFormValues {
  return {
    name: "",
    description: "",
    clientId: "",
    frequency: "MONTHLY",
    interval: 1,
    startDate: new Date().toISOString().slice(0, 10),
    endDate: "",
    dueDateOffsetDays: 14,
    autoIssue: false,
    items: [{ description: "", quantity: 1, unitPrice: "0.00" }],
  };
}

export function scheduleToForm(schedule: RecurringSchedule): RecurringFormValues {
  return {
    name: schedule.name,
    description: schedule.description ?? "",
    clientId: schedule.clientId,
    frequency: schedule.frequency,
    interval: schedule.interval,
    startDate: schedule.startDate.slice(0, 10),
    endDate: schedule.endDate?.slice(0, 10) ?? "",
    dueDateOffsetDays: schedule.dueDateOffsetDays,
    autoIssue: schedule.autoIssue,
    items: schedule.items ?? emptyRecurringForm().items,
  };
}
