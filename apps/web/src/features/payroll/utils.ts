export function initialPayrollDates(now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth();
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  return {
    periodStart: iso(new Date(Date.UTC(year, month, 1))),
    periodEnd: iso(new Date(Date.UTC(year, month + 1, 0))),
    paymentDate: iso(new Date(Date.UTC(year, month + 1, 1))),
  };
}
