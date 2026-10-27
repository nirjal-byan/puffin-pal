export function workforceIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function workforceCalendarRange(anchor: Date, view: "month" | "week") {
  if (view === "week") {
    const normalized = new Date(
      Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate()),
    );
    const from = new Date(normalized);
    from.setUTCDate(normalized.getUTCDate() - normalized.getUTCDay());
    const to = new Date(from);
    to.setUTCDate(from.getUTCDate() + 6);
    return { from: workforceIsoDate(from), to: workforceIsoDate(to) };
  }
  return {
    from: workforceIsoDate(new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1))),
    to: workforceIsoDate(new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0))),
  };
}
