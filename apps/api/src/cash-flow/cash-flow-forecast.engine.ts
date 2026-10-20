export type ForecastScenario = "CONSERVATIVE" | "EXPECTED" | "OPTIMISTIC";
export type ForecastSource =
  | "INVOICE"
  | "RECURRING_INVOICE"
  | "FINALIZED_PAYROLL"
  | "APPROVED_PAYROLL"
  | "SALARY_ESTIMATE"
  | "APPROVED_EXPENSE";

export interface ForecastEvent {
  id: string;
  source: ForecastSource;
  direction: "INFLOW" | "OUTFLOW";
  date: string;
  amountCents: bigint;
  label: string;
  assumption?: string;
  overdue?: boolean;
  scenarioDelay?: boolean;
}

export interface ForecastEngineInput {
  from: string;
  horizonDays: number;
  scenario: ForecastScenario;
  currency: string;
  openingBalanceCents: bigint | null;
  expectedCollectionDelayDays: number;
  conservativeDelayAdjustmentDays: number;
  optimisticDelayAdjustmentDays: number;
  events: ForecastEvent[];
}

const DAY_MS = 86_400_000;
export const isoDate = (value: Date | string | number) =>
  new Date(value).toISOString().slice(0, 10);
export const addDays = (date: string, days: number) =>
  isoDate(new Date(`${date}T00:00:00.000Z`).getTime() + days * DAY_MS);

export function moneyToCents(value: string | number): bigint {
  const normalized = String(value).trim();
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(normalized)) throw new Error(`Invalid money: ${value}`);
  const negative = normalized.startsWith("-");
  const [whole, fraction = ""] = normalized.replace("-", "").split(".");
  const cents = BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, "0"));
  return negative ? -cents : cents;
}

export function centsToMoney(value: bigint) {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  return `${negative ? "-" : ""}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`;
}

function scenarioDelay(input: ForecastEngineInput) {
  if (input.scenario === "CONSERVATIVE")
    return input.expectedCollectionDelayDays + input.conservativeDelayAdjustmentDays;
  if (input.scenario === "OPTIMISTIC") return input.optimisticDelayAdjustmentDays;
  return input.expectedCollectionDelayDays;
}

export function buildCashFlowForecast(input: ForecastEngineInput) {
  const to = addDays(input.from, input.horizonDays - 1);
  const delay = scenarioDelay(input);
  const eligible = input.events
    .map((event) => ({
      ...event,
      date: event.scenarioDelay ? addDays(event.date, delay) : event.date,
    }))
    .filter((event) => event.date >= input.from && event.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

  const byDate = new Map<string, ForecastEvent[]>();
  for (const event of eligible) byDate.set(event.date, [...(byDate.get(event.date) ?? []), event]);
  let running = input.openingBalanceCents;
  let totalInflows = 0n;
  let totalOutflows = 0n;
  const daily = Array.from({ length: input.horizonDays }, (_, index) => {
    const date = addDays(input.from, index);
    const events = byDate.get(date) ?? [];
    const inflows = events
      .filter((event) => event.direction === "INFLOW")
      .reduce((sum, event) => sum + event.amountCents, 0n);
    const outflows = events
      .filter((event) => event.direction === "OUTFLOW")
      .reduce((sum, event) => sum + event.amountCents, 0n);
    totalInflows += inflows;
    totalOutflows += outflows;
    if (running !== null) running += inflows - outflows;
    return {
      date,
      inflows: centsToMoney(inflows),
      outflows: centsToMoney(outflows),
      net: centsToMoney(inflows - outflows),
      closingBalance: running === null ? null : centsToMoney(running),
    };
  });
  const sourceTotals = new Map<ForecastSource, bigint>();
  for (const event of eligible)
    sourceTotals.set(event.source, (sourceTotals.get(event.source) ?? 0n) + event.amountCents);

  return {
    currency: input.currency,
    scenario: input.scenario,
    range: { from: input.from, to, horizonDays: input.horizonDays },
    summary: {
      openingBalance:
        input.openingBalanceCents === null ? null : centsToMoney(input.openingBalanceCents),
      projectedInflows: centsToMoney(totalInflows),
      projectedOutflows: centsToMoney(totalOutflows),
      projectedNet: centsToMoney(totalInflows - totalOutflows),
      projectedClosingBalance: running === null ? null : centsToMoney(running),
      overdueReceivables: centsToMoney(
        input.events
          .filter((event) => event.overdue)
          .reduce((sum, event) => sum + event.amountCents, 0n),
      ),
    },
    daily,
    breakdown: [...sourceTotals.entries()].map(([source, amount]) => ({
      source,
      amount: centsToMoney(amount),
      direction: source.includes("INVOICE") ? "INFLOW" : "OUTFLOW",
    })),
    events: eligible.map((event) => ({
      id: event.id,
      source: event.source,
      direction: event.direction,
      date: event.date,
      amount: centsToMoney(event.amountCents),
      label: event.label,
      assumption: event.assumption ?? null,
      overdue: event.overdue ?? false,
    })),
  };
}
