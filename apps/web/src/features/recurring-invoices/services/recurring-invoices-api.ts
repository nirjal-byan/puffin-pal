import type { Client, WorkspaceApi } from "@/lib/api";
import type { RecurringOccurrence, RecurringSchedule } from "../types";

export async function loadRecurringWorkspace(api: WorkspaceApi) {
  const [schedules, clients] = await Promise.all([
    api<RecurringSchedule[]>("/recurring-invoices?limit=100&offset=0"),
    api<Client[]>("/clients?limit=100&offset=0"),
  ]);
  return { schedules, clients };
}

export async function loadRecurringSchedule(api: WorkspaceApi, id: string) {
  const [schedule, occurrences] = await Promise.all([
    api<RecurringSchedule>(`/recurring-invoices/${id}`),
    api<RecurringOccurrence[]>(`/recurring-invoices/${id}/occurrences`),
  ]);
  return { schedule, occurrences };
}
