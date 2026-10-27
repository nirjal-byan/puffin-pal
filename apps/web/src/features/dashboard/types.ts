export interface FinancialSummary {
  currency: string;
  range: { from: string; to: string; granularity: "day" | "week" | "month" };
  metrics: {
    invoicedRevenue: string;
    paymentsReceived: string;
    outstandingBalance: string;
    overdueBalance: string;
    expenses: string;
    netCashFlow: string;
  };
  trend: Array<{ date: string; revenue: string; collections: string; expenses: string }>;
  invoiceStatuses: Array<{ status: string; count: number }>;
  expenseCategories: Array<{ category: string; amount: string }>;
  aging: Array<{ bucket: string; amount: string; count: number }>;
}

export type DashboardPreset = "month" | "30" | "90" | "year" | "custom";
