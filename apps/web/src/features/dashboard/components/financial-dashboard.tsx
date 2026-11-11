"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Permission } from "@puffinpal/permissions";
import type { Tab } from "@/lib/navigation";
import type { WorkspaceApi } from "@/lib/api";
import type { DashboardPreset as Preset } from "../types";
import {
  DASHBOARD_CHART_COLORS as COLORS,
  dashboardLabel as title,
  dashboardPresetRange as presetRange,
  formatDashboardMoney as money,
} from "../utils";
import { useFinancialSummary } from "../hooks/use-financial-summary";
import { DashboardPeriodFilter } from "./dashboard-period-filter";

export function FinancialDashboard({ api, permissions = [], navigate }: {
  api: WorkspaceApi;
  permissions?: readonly Permission[];
  navigate?: (tab: Tab) => void;
}) {
  const initial = useMemo(() => presetRange("30"), []);
  const [preset, setPreset] = useState<Preset>("30");
  const [draftRange, setDraftRange] = useState(initial);
  const [range, setRange] = useState(initial);
  const { summary, loading, error, reload } = useFinancialSummary(api, range);

  const trend =
    summary?.trend.map((point) => ({
      ...point,
      revenue: Number(point.revenue),
      collections: Number(point.collections),
      expenses: Number(point.expenses),
      outflows: point.outflows === null ? undefined : Number(point.outflows),
    })) ?? [];
  const categories =
    summary?.expenseCategories.map((item) => ({
      ...item,
      amount: Number(item.amount),
      label: title(item.category),
    })) ?? [];
  const empty =
    summary &&
    Object.values(summary.metrics).every((value) => Number(value) === 0) &&
    summary.invoiceStatuses.every((item) => item.count === 0) &&
    Object.values(summary.attention).every((value) => Number(value) === 0);
  const currency = summary?.currency ?? "USD";
  const tooltipFormatter = (value: unknown) =>
    money(String(Array.isArray(value) ? (value[0] ?? 0) : (value ?? 0)), currency);

  return (
    <section className="financial-dashboard" aria-labelledby="financial-dashboard-title">
      <div className="dashboard-heading-row" data-tour="page-heading">
        <div>
          <h1 id="financial-dashboard-title">Financial overview</h1>
          <p>Track billing and recorded cash movement at a glance.</p>
        </div>
        <DashboardPeriodFilter
          preset={preset}
          draftRange={draftRange}
          setPreset={setPreset}
          setDraftRange={setDraftRange}
          setRange={setRange}
        />
      </div>

      {error ? (
        <div className="panel dashboard-state" role="alert">
          <p>{error}</p>
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              reload();
            }}
          >
            Try again
          </button>
        </div>
      ) : loading ? (
        <div className="dashboard-kpi-grid" aria-label="Loading financial summary">
          {Array.from({ length: 8 }, (_, index) => (
            <div className="panel dashboard-kpi skeleton" key={index} />
          ))}
        </div>
      ) : summary ? (
        <>
          <p className="muted">{summary.range.from} – {summary.range.to} · {currency} only; no currency conversion.
            Expenses use the organization currency. Other invoice, bill and payroll currencies are excluded.</p>
          <div
            className="dashboard-kpi-grid"
            aria-label="Financial summary"
            data-tour="dashboard-summary"
          >
            {(
              [
                ["Invoiced revenue", summary.metrics.invoicedRevenue, "Issued invoice value in this period"],
                ["Payments received", summary.metrics.paymentsReceived, "Collected in this period"],
                ["Outstanding", summary.metrics.outstandingBalance, `As of ${summary.range.to}`],
                ["Overdue", summary.metrics.overdueBalance, `Past due as of ${summary.range.to}`],
                ["Approved expenses", summary.metrics.expenses, "Approved costs by expense date; not cash paid"],
                ["Cash outflows", summary.metrics.cashOutflows, "Active payable payments + payroll payments"],
                ["Outstanding payables", summary.metrics.outstandingPayables, `Approved bill balances as of ${summary.range.to}`],
                ["Net cash flow", summary.metrics.netCashFlow, "Collections minus recorded cash outflows"],
              ] as const
            ).map(([label, value, detail]) => (
              <article className="dashboard-kpi" key={label}>
                <span>{label}</span>
                <strong>{value === null ? "Unavailable" : money(value, currency)}</strong>
                <small>{detail}</small>
              </article>
            ))}
          </div>
          <section className="panel" aria-label="Financial attention">
            <h3>Needs attention</h3>
            <p className="muted">Records dated through {summary.range.to}, using current approval and reversal states.
              Balances include payments through that date. These are not immutable historical snapshots.</p>
            <div className="overview-links">
              {([
                ["Overdue invoices", summary.attention.overdueInvoices, summary.metrics.overdueBalance, "invoices", "invoices:read"],
                ["Unpaid bills", summary.attention.unpaidBills, summary.metrics.outstandingPayables, "accounts-payable", "accounts-payable:read"],
                ["Expenses awaiting approval", summary.attention.pendingExpenses, null, "expenses", "expenses:approve"],
                ["Standalone expenses awaiting settlement", summary.attention.unsettledExpenses, summary.attention.unsettledExpenseAmount, "expenses", "expenses:read"],
              ] as const).filter(([, count, , , permission]) => count !== null && permissions.includes(permission)).map(([label, count, amount, tab]) => (
                <button type="button" className="overview-link" key={label} disabled={!navigate} onClick={() => navigate?.(tab)}>
                  <span><strong>{label}: {count}</strong>{amount !== null && <small> · {money(amount, currency)}</small>}</span>
                  <span aria-hidden="true">→</span>
                </button>
              ))}
            </div>
            <small>Linked expenses are included in bill balances and excluded from standalone settlements.</small>
          </section>
          {empty ? (
            <div className="panel dashboard-state">
              <h3>No financial activity yet</h3>
              <p className="muted">
                Create and issue invoices, record payments, or add expenses to see analytics here.
              </p>
            </div>
          ) : (
            <div className="dashboard-chart-grid" aria-busy={loading} data-tour="dashboard-charts">
              <article
                className="panel dashboard-chart dashboard-chart-wide"
                role="img"
                aria-label="Invoiced revenue, collections and recorded cash outflows trend"
              >
                <header>
                  <div>
                    <span className="dashboard-chart-kicker">Issued value and recorded payments</span>
                    <h3>Billing and cash movement ({currency})</h3>
                  </div>
                  <span>{title(summary.range.granularity)} view</span>
                </header>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={trend} margin={{ left: 4, right: 12, top: 12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="date"
                      minTickGap={28}
                      tickFormatter={(value) => String(value).slice(5)}
                    />
                    <YAxis width={52} />
                    <Tooltip formatter={tooltipFormatter} />
                    <Line
                      type="linear"
                      dataKey="revenue"
                      name="Invoiced"
                      stroke="#478d6d"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                    <Line
                      type="linear"
                      dataKey="collections"
                      name="Collected"
                      stroke="#3178c6"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                    {summary.metrics.cashOutflows !== null && <Line type="linear" dataKey="outflows" name="Cash outflows" stroke="#d16a62" strokeWidth={2.5} dot={false} />}
                  </LineChart>
                </ResponsiveContainer>
                <div className="dashboard-chart-key">
                  {summary.metrics.cashOutflows !== null && <span>Cash outflows (red)</span>}
                  <span>
                    <i className="revenue" />
                    Invoiced
                  </span>
                  <span>
                    <i className="collections" />
                    Collected
                  </span>
                </div>
              </article>
              <article
                className="panel dashboard-chart"
                role="img"
                aria-label="Invoice status distribution"
              >
                <header>
                  <div>
                    <span className="dashboard-chart-kicker">Invoices</span>
                    <h3>Status breakdown</h3>
                  </div>
                  <span>As of period end</span>
                </header>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={summary.invoiceStatuses}
                      dataKey="count"
                      nameKey="status"
                      innerRadius={48}
                      outerRadius={78}
                      paddingAngle={2}
                    >
                      {summary.invoiceStatuses.map((item, index) => (
                        <Cell key={item.status} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [value ?? 0, "Invoices"]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="dashboard-legend">
                  {summary.invoiceStatuses.map((item, index) => (
                    <span key={item.status}>
                      <i style={{ background: COLORS[index % COLORS.length] }} />
                      {title(item.status)} <strong>{item.count}</strong>
                    </span>
                  ))}
                </div>
              </article>
              <article
                className="panel dashboard-chart"
                role="img"
                aria-label="Expenses grouped by category"
              >
                <header>
                  <div>
                    <span className="dashboard-chart-kicker">Spending</span>
                    <h3>Expense categories</h3>
                  </div>
                  <span>Approved costs · {currency}</span>
                </header>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={categories} layout="vertical" margin={{ left: 18 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" />
                    <YAxis dataKey="label" type="category" width={82} />
                    <Tooltip formatter={tooltipFormatter} />
                    <Bar dataKey="amount" name="Expenses" fill="#d16a62" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </article>
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}
