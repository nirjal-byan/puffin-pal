import type { DashboardPreset } from "./types";

export const DASHBOARD_CHART_COLORS = ["#478d6d", "#3178c6", "#e0a73d", "#d16a62", "#8c70b8"];

export function dashboardPresetRange(preset: Exclude<DashboardPreset, "custom">, now = new Date()) {
  const end = new Date(now);
  const start = new Date(end);
  if (preset === "month") start.setUTCDate(1);
  if (preset === "30") start.setUTCDate(start.getUTCDate() - 29);
  if (preset === "90") start.setUTCDate(start.getUTCDate() - 89);
  if (preset === "year") start.setUTCMonth(0, 1);
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  return { from: iso(start), to: iso(end) };
}

export function formatDashboardMoney(value: string, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(Number(value));
}

export function dashboardLabel(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
