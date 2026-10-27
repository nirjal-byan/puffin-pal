export type CashFlowScenario = "CONSERVATIVE" | "EXPECTED" | "OPTIMISTIC";

export interface CashFlowConfiguration {
  openingBalance: string | null;
  openingBalanceDate: string | null;
  defaultHorizonDays: number;
  expectedInvoiceCollectionDelay: number;
  conservativeDelayAdjustmentDays: number;
  optimisticDelayAdjustmentDays: number;
  includeRecurringInvoices: boolean;
  includeApprovedPayroll: boolean;
  includeSalaryEstimates: boolean;
  includeApprovedExpenses: boolean;
  version: number;
}

export interface CashFlowForecast {
  currency: string;
  scenario: CashFlowScenario;
  range: { from: string; to: string; horizonDays: number };
  summary: Record<
    | "openingBalance"
    | "projectedInflows"
    | "projectedOutflows"
    | "projectedNet"
    | "projectedClosingBalance"
    | "overdueReceivables",
    string | null
  >;
  daily: Array<{
    date: string;
    inflows: string;
    outflows: string;
    net: string;
    closingBalance: string | null;
  }>;
  breakdown: Array<{ source: string; amount: string; direction: string }>;
  events: Array<{
    id: string;
    source: string;
    direction: string;
    date: string;
    amount: string;
    label: string;
    assumption: string | null;
    overdue: boolean;
  }>;
  configuration: CashFlowConfiguration;
  warnings: string[];
}
