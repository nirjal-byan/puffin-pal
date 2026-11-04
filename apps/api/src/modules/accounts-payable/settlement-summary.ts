// Read-side totals only. Writes remain in AccountsPayableService under row locks.
export function settlementSummary(
  total: string,
  currency: string,
  payments: readonly { amount: string; currency: string; reversedAt: unknown }[],
) {
  const cents = (value: string) => {
    const [whole, fraction = ""] = value.split(".");
    return BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, "0"));
  };
  const money = (value: bigint) => `${value / 100n}.${String(value % 100n).padStart(2, "0")}`;
  const paid = payments
    .filter((payment) => !payment.reversedAt && payment.currency === currency)
    .reduce((sum, payment) => sum + cents(payment.amount), 0n);
  const amount = cents(total);
  const balance = amount > paid ? amount - paid : 0n;
  return {
    currency,
    totalAmount: money(amount),
    paidAmount: money(paid),
    balance: money(balance),
    settlementStatus: paid === 0n ? "UNPAID" : balance === 0n ? "PAID" : "PARTIALLY_PAID",
  };
}
