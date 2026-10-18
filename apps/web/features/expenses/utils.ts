export const currentDate = () => new Date().toISOString().slice(0, 10);

function localDateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function expensePeriodRange(period: string, now = new Date()) {
  if (period === "last7" || period === "last30") {
    const from = new Date(now);
    from.setDate(from.getDate() - (period === "last7" ? 6 : 29));
    return { from: localDateValue(from), to: localDateValue(now) };
  }
  if (period === "thisMonth") {
    return {
      from: localDateValue(new Date(now.getFullYear(), now.getMonth(), 1)),
      to: localDateValue(now),
    };
  }
  if (period === "lastMonth") {
    return {
      from: localDateValue(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      to: localDateValue(new Date(now.getFullYear(), now.getMonth(), 0)),
    };
  }
  if (period === "thisYear") {
    return { from: localDateValue(new Date(now.getFullYear(), 0, 1)), to: localDateValue(now) };
  }
  return null;
}

export function formatExpenseMoney(value: string, currency: string) {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).format(Number(value));
  } catch {
    return `${currency} ${value}`;
  }
}
