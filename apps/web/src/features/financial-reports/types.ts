export type MoneyMetric = string;
export type ReportBreakdown = { amount: string; [key: string]: string | number };
export type ReportTrend = {
  period: string;
  invoiced: string;
  collected: string;
  expenses: string;
  payroll: string;
  profit: string;
};
export type FinancialReport = {
  currency: string;
  period: { from: string; to: string; groupBy: string };
  basis: { name: string; disclosures: string[] };
  revenue: {
    issued: MoneyMetric;
    collected: MoneyMetric;
    outstanding: MoneyMetric;
    overdue: MoneyMetric;
    byClient: ReportBreakdown[];
    byStatus: ReportBreakdown[];
  };
  expenses: {
    recorded: MoneyMetric;
    approved: MoneyMetric;
    paid: MoneyMetric;
    unpaid: MoneyMetric;
    byCategory: ReportBreakdown[];
    byVendor: ReportBreakdown[];
    largest: ReportBreakdown[];
  };
  payroll: {
    gross: MoneyMetric;
    employeeDeductions: MoneyMetric;
    employerContributions: MoneyMetric;
    net: MoneyMetric;
    paid: MoneyMetric;
    unpaidFinalized: MoneyMetric;
    employeeDetailAvailable: boolean;
    byEmployee: ReportBreakdown[];
  };
  profitability: {
    basis: string;
    revenue: MoneyMetric;
    operatingCosts: MoneyMetric;
    profit: MoneyMetric;
    marginPercent: string | null;
  };
  receivables: { aging: ReportBreakdown[]; byClient: ReportBreakdown[] };
  payables: {
    available: true;
    outstanding: MoneyMetric;
    overdue: MoneyMetric;
    payments: MoneyMetric;
    aging: ReportBreakdown[];
    byVendor: ReportBreakdown[];
  };
  cashMovement: {
    inflows: MoneyMetric;
    outflows: MoneyMetric;
    net: MoneyMetric;
    reconciledInflows: MoneyMetric;
    reconciledOutflows: MoneyMetric;
    forecastIncluded: false;
  };
  trend: ReportTrend[];
};
