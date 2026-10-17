"use client";

import { useEffect, useMemo, useState } from "react";
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
import { errorMessage, type WorkspaceApi } from "../../lib/api";

type Summary = {
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
  trend: { date: string; revenue: string; collections: string; expenses: string }[];
  invoiceStatuses: { status: string; count: number }[];
  expenseCategories: { category: string; amount: string }[];
  aging: { bucket: string; amount: string; count: number }[];
};

type Preset = "month" | "30" | "90" | "year" | "custom";
const COLORS = ["#478d6d", "#3178c6", "#e0a73d", "#d16a62", "#8c70b8"];

function iso(date: Date) {
  return date.toISOString().slice(0, 10);
}
function presetRange(preset: Exclude<Preset, "custom">) {
  const end = new Date();
  const start = new Date(end);
  if (preset === "month") start.setUTCDate(1);
  if (preset === "30") start.setUTCDate(start.getUTCDate() - 29);
  if (preset === "90") start.setUTCDate(start.getUTCDate() - 89);
  if (preset === "year") start.setUTCMonth(0, 1);
  return { from: iso(start), to: iso(end) };
}
function money(value: string, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(Number(value));
}
function title(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function FinancialDashboard({ api }: { api: WorkspaceApi }) {
  const initial = useMemo(() => presetRange("30"), []);
  const [preset, setPreset] = useState<Preset>("30");
  const [draftRange, setDraftRange] = useState(initial);
  const [range, setRange] = useState(initial);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api<Summary>(`/dashboard/financial-summary?from=${range.from}&to=${range.to}`, { signal: controller.signal })
      .then(setSummary)
      .catch((failure: unknown) => {
        if (!(failure instanceof Error && failure.name === "AbortError")) setError(errorMessage(failure));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [api, range, revision]);

  function choosePreset(next: Exclude<Preset, "custom">) {
    const nextRange = presetRange(next);
    setLoading(true);
    setError("");
    setPreset(next);
    setDraftRange(nextRange);
    setRange(nextRange);
  }

  const trend = summary?.trend.map((point) => ({
    ...point,
    revenue: Number(point.revenue),
    collections: Number(point.collections),
    expenses: Number(point.expenses),
  })) ?? [];
  const categories = summary?.expenseCategories.map((item) => ({ ...item, amount: Number(item.amount), label: title(item.category) })) ?? [];
  const empty = summary && Object.values(summary.metrics).every((value) => Number(value) === 0) && summary.invoiceStatuses.every((item) => item.count === 0);
  const currency = summary?.currency ?? "USD";
  const tooltipFormatter = (value: unknown) =>
    money(String(Array.isArray(value) ? (value[0] ?? 0) : (value ?? 0)), currency);

  return (
    <section className="financial-dashboard" aria-labelledby="financial-dashboard-title">
      <div className="dashboard-heading-row">
        <div>
          <h1 id="financial-dashboard-title">Financial overview</h1>
          <p>Track billing and cash flow at a glance.</p>
        </div>
        <div className="dashboard-filters" aria-label="Reporting period">
          <div className="dashboard-presets">
            {([['month', 'Month'], ['30', '30 days'], ['90', '90 days'], ['year', 'Year']] as const).map(([value, label]) => (
              <button key={value} type="button" className={`button compact ${preset === value ? "primary" : "secondary"}`} onClick={() => choosePreset(value)}>{label}</button>
            ))}
            <button type="button" className={`button compact ${preset === "custom" ? "primary" : "secondary"}`} onClick={() => setPreset("custom")}>Custom</button>
          </div>
          {preset === "custom" && (
            <div className="dashboard-custom-range">
              <label>From<input type="date" value={draftRange.from} max={draftRange.to} onChange={(event) => setDraftRange((current) => ({ ...current, from: event.target.value }))} /></label>
              <label>To<input type="date" value={draftRange.to} min={draftRange.from} onChange={(event) => setDraftRange((current) => ({ ...current, to: event.target.value }))} /></label>
              <button type="button" className="button primary compact" disabled={!draftRange.from || !draftRange.to || draftRange.from > draftRange.to} onClick={() => { setLoading(true); setError(""); setRange(draftRange); }}>Apply</button>
            </div>
          )}
        </div>
      </div>

      {error ? (
        <div className="panel dashboard-state" role="alert"><p>{error}</p><button type="button" className="button secondary" onClick={() => { setLoading(true); setError(""); setRevision((value) => value + 1); }}>Try again</button></div>
      ) : loading && !summary ? (
        <div className="dashboard-kpi-grid" aria-label="Loading financial summary">{Array.from({ length: 6 }, (_, index) => <div className="panel dashboard-kpi skeleton" key={index} />)}</div>
      ) : summary ? (
        <>
          <div className="dashboard-kpi-grid" aria-label="Financial summary">
            {([
              ["Invoiced revenue", summary.metrics.invoicedRevenue, "Finalized in this period"],
              ["Payments received", summary.metrics.paymentsReceived, "Collected in this period"],
              ["Outstanding", summary.metrics.outstandingBalance, `As of ${summary.range.to}`],
              ["Overdue", summary.metrics.overdueBalance, `Past due as of ${summary.range.to}`],
              ["Expenses", summary.metrics.expenses, "Recorded in this period"],
              ["Net cash flow", summary.metrics.netCashFlow, "Collections minus expenses"],
            ] as const).map(([label, value, detail]) => (
              <article className="dashboard-kpi" key={label}><span>{label}</span><strong>{money(value, currency)}</strong><small>{detail}</small></article>
            ))}
          </div>
          {empty ? (
            <div className="panel dashboard-state"><h3>No financial activity yet</h3><p className="muted">Create and issue invoices, record payments, or add expenses to see analytics here.</p></div>
          ) : (
            <div className="dashboard-chart-grid" aria-busy={loading}>
              <article className="panel dashboard-chart dashboard-chart-wide" role="img" aria-label="Invoiced revenue and payment collections trend">
                <header><div><span className="dashboard-chart-kicker">Cash flow</span><h3>Revenue and collections</h3></div><span>{title(summary.range.granularity)} view</span></header>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={trend} margin={{ left: 4, right: 12, top: 12, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="date" minTickGap={28} tickFormatter={(value) => String(value).slice(5)} /><YAxis width={52}/><Tooltip formatter={tooltipFormatter}/><Line type="monotone" dataKey="revenue" name="Invoiced" stroke="#478d6d" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }}/><Line type="monotone" dataKey="collections" name="Collected" stroke="#3178c6" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }}/></LineChart>
                </ResponsiveContainer>
                <div className="dashboard-chart-key"><span><i className="revenue"/>Invoiced</span><span><i className="collections"/>Collected</span></div>
              </article>
              <article className="panel dashboard-chart" role="img" aria-label="Invoice status distribution">
                <header><div><span className="dashboard-chart-kicker">Invoices</span><h3>Status breakdown</h3></div><span>As of period end</span></header>
                <ResponsiveContainer width="100%" height={220}><PieChart><Pie data={summary.invoiceStatuses} dataKey="count" nameKey="status" innerRadius={48} outerRadius={78} paddingAngle={2}>{summary.invoiceStatuses.map((item, index) => <Cell key={item.status} fill={COLORS[index % COLORS.length]}/>)}</Pie><Tooltip formatter={(value) => [value ?? 0, "Invoices"]}/></PieChart></ResponsiveContainer>
                <div className="dashboard-legend">{summary.invoiceStatuses.map((item, index) => <span key={item.status}><i style={{ background: COLORS[index % COLORS.length] }}/>{title(item.status)} <strong>{item.count}</strong></span>)}</div>
              </article>
              <article className="panel dashboard-chart" role="img" aria-label="Expenses grouped by category">
                <header><div><span className="dashboard-chart-kicker">Spending</span><h3>Expense categories</h3></div><span>Current period</span></header>
                <ResponsiveContainer width="100%" height={260}><BarChart data={categories} layout="vertical" margin={{ left: 18 }}><CartesianGrid strokeDasharray="3 3" horizontal={false}/><XAxis type="number"/><YAxis dataKey="label" type="category" width={82}/><Tooltip formatter={tooltipFormatter}/><Bar dataKey="amount" name="Expenses" fill="#d16a62" radius={[0,3,3,0]}/></BarChart></ResponsiveContainer>
              </article>
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}
