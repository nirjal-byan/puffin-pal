"use client";

import { useMemo, useState } from "react";
import type { Permission } from "@puffinpal/permissions";
import type { WorkspaceApi } from "@/lib/api";
import {
  CurrencyDisplay,
  ReportChart,
  ReportDataTable,
  ReportSummaryCard,
} from "./report-components";
import { useFinancialReport } from "../hooks/use-financial-report";
import { reportPresetRange as rangeFor, validReportingRange } from "../utils";
import { DatePicker } from "@/components/ui/date-picker";

type Preset = "month" | "previous-month" | "quarter" | "year" | "custom";

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
  const [exporting, setExporting] = useState(false);
  const query = useMemo(
    () => new URLSearchParams({ ...range, currency, groupBy: "month" }).toString(),
    [range, currency],
  );
  const validRange = validReportingRange(range.from, range.to);
  const { report, loading, error, reload } = useFinancialReport(api, query, validRange);
  const selectPreset = (next: Exclude<Preset, "custom">) => {
    setPreset(next);
    setRange(rangeFor(next));
  };
  const download = async (format: "csv" | "pdf") => {
    if (exporting || loading || !validRange || error || !report) return;
    setExporting(true);
    try {
      const blob = await api<Blob>(`/financial-reports/export?${query}&format=${format}`, {
        responseType: "file",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `operational-report-${range.from}-${range.to}.${format}`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (failure) {
      onError(failure);
    } finally {
      setExporting(false);
    }
  };
  const positive = Number(report?.profitability.profit ?? 0) >= 0;
  return (
    <div className="financial-reports" aria-busy={loading || exporting}>
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
            <button disabled={loading || exporting || !validRange || !!error || !report} className="button secondary compact" onClick={() => void download("csv")}>
              Export CSV
            </button>
            <button disabled={loading || exporting || !validRange || !!error || !report} className="button secondary compact" onClick={() => void download("pdf")}>
              Export PDF
            </button>
          </div>
        )}
      </section>
      {!validRange ? <div className="panel" role="alert">Choose valid dates in order, within five years.</div>
        : error ? <div className="panel" role="alert"><p>{error}</p><button className="button secondary" onClick={reload}>Try again</button></div>
        : loading ? <section className="panel loading" role="status">Loading financial reports…</section>
        : report ? <>
      <p className="muted">{report.period.from} – {report.period.to} · {report.currency}. Balances are through the end date;
        approval and reversal states reflect current records.</p>
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
          note="Approved expenses + gross payroll + employer contributions"
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
        {report.basis.disclosures.map((disclosure) => <p key={disclosure}>{disclosure}</p>)}
      </section>
      <section className="panel report-trend">
        <h3>Financial performance over time</h3>
        <p>Issued revenue compared with approved expenses and finalized gross payroll plus employer contributions.</p>
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
      </> : null}
    </div>
  );
}
