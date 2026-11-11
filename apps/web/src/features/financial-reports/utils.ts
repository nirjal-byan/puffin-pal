export type ReportPreset = "month" | "previous-month" | "quarter" | "year";

export function reportPresetRange(preset: ReportPreset, now = new Date()) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  if (preset === "previous-month") return {
    from: iso(new Date(Date.UTC(year, month - 1, 1))),
    to: iso(new Date(Date.UTC(year, month, 0))),
  };
  const startMonth = preset === "year" ? 0 : preset === "quarter" ? Math.floor(month / 3) * 3 : month;
  return { from: iso(new Date(Date.UTC(year, startMonth, 1))), to: iso(now) };
}

export function validReportingRange(from: string, to: string) {
  const valid = (day: string) => /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    Number.isFinite(Date.parse(day)) && new Date(day).toISOString().slice(0, 10) === day;
  if (!valid(from) || !valid(to)) return false;
  const days = (Date.parse(to) - Date.parse(from)) / 86_400_000;
  return days >= 0 && days <= 1_826;
}
