"use client";

import { useEffect, useMemo, useState } from "react";
import type { Permission } from "@puffinpal/permissions";
import type { WorkspaceApi } from "@/lib/api";
import {
  CurrencyDisplay,
  ReportChart,
  ReportDataTable,
  ReportSummaryCard,
} from "./report-components";
import type { FinancialReport } from "../types";
import { DatePicker } from "@/components/ui/date-picker";

type Preset = "month" | "previous-month" | "quarter" | "year" | "custom";
const iso = (date: Date) => date.toISOString().slice(0, 10);
function rangeFor(preset: Exclude<Preset, "custom">) {
  const now = new Date();
  if (preset === "previous-month") {
    return {
      from: iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      to: iso(new Date(now.getFullYear(), now.getMonth(), 0)),
    };
  }
  if (preset === "quarter") {
    const month = Math.floor(now.getMonth() / 3) * 3;
    return { from: iso(new Date(now.getFullYear(), month, 1)), to: iso(now) };
  }
  if (preset === "year") return { from: `${now.getFullYear()}-01-01`, to: iso(now) };
  return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(now) };
}

export default function FinancialReportsPage({
  api,
  currency,
  permissions,
  onError,
}: {
  api: WorkspaceApi;
  currency: string;
  permissions: readonly Permission[];
  onError: (error: unknown) => void;
}) {
  const [preset, setPreset] = useState<Preset>("year");
  const [range, setRange] = useState(() => rangeFor("year"));
  const [report, setReport] = useState<FinancialReport | null>(null);
  const [loading, setLoading] = useState(true);
  const query = useMemo(
    () => new URLSearchParams({ ...range, currency, groupBy: "month" }).toString(),
    [range, currency],
  );
  useEffect(() => {
    const controller = new AbortController();
    api<FinancialReport>(`/financial-reports/overview?${query}`, { signal: controller.signal })
      .then(setReport)
      .catch((error) => {
        if (!controller.signal.aborted) onError(error);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [api, onError, query]);
  const selectPreset = (next: Exclude<Preset, "custom">) => {
    setPreset(next);
    setRange(rangeFor(next));
  };
  const download = async (format: "csv" | "pdf") => {
    const blob = await api<Blob>(`/financial-reports/export?${query}&format=${format}`, {
      responseType: "file",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `operational-report-${range.from}-${range.to}.${format}`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  if (loading && !report)
    return (
      <section className="panel loading">
        <span className="spinner" />
        Loading financial reports…
      </section>
    );
  if (!report) return null;
  const positive = Number(report.profitability.profit) >= 0;
  return (
    <div className="financial-reports">
      <section className="panel report-filter-bar">
        <div>
          <strong>Reporting period</strong>
          <small>All totals are isolated to {currency}; no currency conversion is applied.</small>
        </div>
        <div className="report-presets" role="group" aria-label="Reporting period">
          {(["month", "previous-month", "quarter", "year"] as const).map((item) => (
            <button
              type="button"
              key={item}
              className={`button compact ${preset === item ? "primary" : "secondary"}`}
              onClick={() => selectPreset(item)}
            >
              {item.replace("-", " ")}
            </button>
          ))}
        </div>
        <div className="report-custom-range">
          <label>
            <span>From</span>
            <DatePicker
              value={range.from}
              max={range.to}
              ariaLabel="Report start date"
              onChange={(from) => {
                setPreset("custom");
                setRange((current) => ({ ...current, from }));
              }}
            />
          </label>
          <label>
            <span>To</span>
            <DatePicker
              value={range.to}
              min={range.from}
              ariaLabel="Report end date"
              onChange={(to) => {
                setPreset("custom");
                setRange((current) => ({ ...current, to }));
              }}
            />
          </label>
        </div>
        {permissions.includes("financial-reports:export") && (
          <div className="report-export-actions">
            <button className="button secondary compact" onClick={() => void download("csv")}>
              Export CSV
            </button>
            <button className="button secondary compact" onClick={() => void download("pdf")}>
              Export PDF
            </button>
          </div>
        )}
      </section>
      <section className="report-summary-grid" aria-label="Financial summary">
        <ReportSummaryCard
          label="Issued revenue"
          value={<CurrencyDisplay currency={currency} value={report.revenue.issued} />}
          note="Issued invoice value"
        />
        <ReportSummaryCard
          label="Collected"
          value={<CurrencyDisplay currency={currency} value={report.revenue.collected} />}
          note="Recorded invoice payments"
        />
        <ReportSummaryCard
          label="Operating costs"
          value={
            <CurrencyDisplay currency={currency} value={report.profitability.operatingCosts} />
          }
          note="Approved expenses + payroll cost"
        />
        <ReportSummaryCard
          label="Operational profit"
          value={
            <span className={positive ? "metric-positive" : "metric-negative"}>
              <CurrencyDisplay currency={currency} value={report.profitability.profit} />
            </span>
          }
          note="Issued revenue minus supported costs"
        />
      </section>
      <section className="panel report-disclosure">
        <strong>{report.basis.name}</strong>
        <p>{report.basis.disclosures[0]}</p>
      </section>
      <section className="panel report-trend">
        <h3>Financial performance over time</h3>
        <p>Issued revenue compared with approved expenses and finalized gross payroll.</p>
        <ReportChart rows={report.trend} currency={currency} />
      </section>
      <div className="report-two-column">
        <section className="panel">
          <h3>Revenue by client</h3>
          <ReportDataTable
            caption="Client"
            labelKey="client"
            rows={report.revenue.byClient}
            currency={currency}
          />
        </section>
        <section className="panel">
          <h3>Approved expenses by category</h3>
          <ReportDataTable
            caption="Category"
            labelKey="category"
            rows={report.expenses.byCategory}
            currency={currency}
          />
        </section>
        <section className="panel">
          <h3>Receivables aging</h3>
          <ReportDataTable
            caption="Aging bucket"
            labelKey="bucket"
            rows={report.receivables.aging}
            currency={currency}
          />
        </section>
        <section className="panel">
          <h3>Payables aging</h3>
          <ReportDataTable
            caption="Aging bucket"
            labelKey="bucket"
            rows={report.payables.aging}
            currency={currency}
          />
        </section>
        <section className="panel">
          <h3>Outstanding by vendor</h3>
          <ReportDataTable
            caption="Vendor"
            labelKey="vendor"
            rows={report.payables.byVendor}
            currency={currency}
          />
        </section>
        <section className="panel">
          <h3>Cash movement</h3>
          <dl className="report-metric-list">
            <div>
              <dt>Recorded inflows</dt>
              <dd>
                <CurrencyDisplay currency={currency} value={report.cashMovement.inflows} />
              </dd>
            </div>
            <div>
              <dt>Recorded outflows</dt>
              <dd>
                <CurrencyDisplay currency={currency} value={report.cashMovement.outflows} />
              </dd>
            </div>
            <div>
              <dt>Net movement</dt>
              <dd>
                <CurrencyDisplay currency={currency} value={report.cashMovement.net} />
              </dd>
            </div>
          </dl>
          <small>Forecasts and unmatched imported bank transactions are excluded.</small>
        </section>
      </div>
      <section className="panel report-disclosure">
        <strong>Accounts payable activity</strong>
        <p>
          <CurrencyDisplay currency={currency} value={report.payables.outstanding} /> outstanding ·{" "}
          <CurrencyDisplay currency={currency} value={report.payables.overdue} /> overdue ·{" "}
          <CurrencyDisplay currency={currency} value={report.payables.payments} /> paid during this
          period.
        </p>
      </section>
    </div>
  );
}
