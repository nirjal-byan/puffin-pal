"use client";

import { useEffect, useMemo, useState } from "react";
import type { Permission } from "@puffinpal/permissions";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppModal } from "../../../components/app-modal";
import { errorMessage, type WorkspaceApi } from "../../../lib/api";

type Scenario = "CONSERVATIVE" | "EXPECTED" | "OPTIMISTIC";
interface Configuration {
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
interface Forecast {
  currency: string;
  scenario: Scenario;
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
  daily: {
    date: string;
    inflows: string;
    outflows: string;
    net: string;
    closingBalance: string | null;
  }[];
  breakdown: { source: string; amount: string; direction: string }[];
  events: {
    id: string;
    source: string;
    direction: string;
    date: string;
    amount: string;
    label: string;
    assumption: string | null;
    overdue: boolean;
  }[];
  configuration: Configuration;
  warnings: string[];
}

const sourceLabel = (value: string) =>
  value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function CashFlowPage({
  api,
  permissions,
  onSaved,
}: {
  api: WorkspaceApi;
  permissions: readonly Permission[];
  onSaved: (message: string) => void;
}) {
  const [scenario, setScenario] = useState<Scenario>("EXPECTED");
  const [horizon, setHorizon] = useState(30);
  const [customHorizon, setCustomHorizon] = useState(false);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    api<Forecast>(`/cash-flow/forecast?horizonDays=${horizon}&scenario=${scenario}`, {
      signal: controller.signal,
    })
      .then((result) => {
        setForecast(result);
        setFailure("");
      })
      .catch((error: unknown) => {
        if (!(error instanceof Error && error.name === "AbortError"))
          setFailure(errorMessage(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [api, horizon, revision, scenario]);
  const money = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: forecast?.currency ?? "USD",
      }),
    [forecast?.currency],
  );
  const amount = (value: string | null) =>
    value === null ? "Not configured" : money.format(Number(value));
  const chart = forecast?.daily.map((point) => ({
    ...point,
    inflows: Number(point.inflows),
    outflows: Number(point.outflows),
    closingBalance: point.closingBalance === null ? undefined : Number(point.closingBalance),
  }));

  if (loading && !forecast)
    return (
      <section className="panel dashboard-state">
        <span className="spinner" /> Loading cash flow forecast…
      </section>
    );
  return (
    <div className="cash-flow-page" data-tour="cash-flow-overview">
      <section className="cash-flow-toolbar panel">
        <div>
          <strong>Forecast controls</strong>
          <span>Compare timing assumptions without changing financial records.</span>
        </div>
        <div className="cash-flow-controls">
          <div className="dashboard-presets" aria-label="Forecast scenario">
            {(["CONSERVATIVE", "EXPECTED", "OPTIMISTIC"] as const).map((value) => (
              <button
                key={value}
                type="button"
                className={`button ${scenario === value ? "primary" : "secondary"}`}
                onClick={() => setScenario(value)}
              >
                {sourceLabel(value)}
              </button>
            ))}
          </div>
          <label>
            Horizon
            <select
              value={customHorizon ? "custom" : horizon}
              onChange={(event) => {
                if (event.target.value === "custom") setCustomHorizon(true);
                else {
                  setCustomHorizon(false);
                  setHorizon(Number(event.target.value));
                }
              }}
            >
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
              <option value={90}>90 days</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          {customHorizon && (
            <label>
              Days
              <input
                type="number"
                min="1"
                max="365"
                value={horizon}
                onChange={(event) =>
                  setHorizon(Math.min(365, Math.max(1, Number(event.target.value))))
                }
              />
            </label>
          )}
          {permissions.includes("cash-flow:manage") && (
            <button
              type="button"
              className="button secondary"
              onClick={() => setSettingsOpen(true)}
            >
              Configure
            </button>
          )}
        </div>
      </section>
      {failure && (
        <p className="alert" role="alert">
          {failure}
        </p>
      )}
      {forecast && (
        <>
          <div className="dashboard-kpi-grid cash-flow-kpis">
            <Kpi
              label="Expected inflows"
              value={amount(forecast.summary.projectedInflows)}
              detail={`${forecast.range.horizonDays}-day horizon`}
            />
            <Kpi
              label="Expected outflows"
              value={amount(forecast.summary.projectedOutflows)}
              detail="Payroll and enabled assumptions"
            />
            <Kpi
              label="Net movement"
              value={amount(forecast.summary.projectedNet)}
              detail={sourceLabel(forecast.scenario)}
            />
            <Kpi
              label="Closing balance"
              value={amount(forecast.summary.projectedClosingBalance)}
              detail={
                forecast.summary.openingBalance === null
                  ? "Add an opening balance to calculate"
                  : `Starts at ${amount(forecast.summary.openingBalance)}`
              }
            />
            <Kpi
              label="Overdue receivables"
              value={amount(forecast.summary.overdueReceivables)}
              detail="Outstanding invoices already past due"
            />
          </div>
          <section className="panel dashboard-chart dashboard-chart-wide cash-flow-chart">
            <header>
              <div>
                <span className="dashboard-chart-kicker">Liquidity</span>
                <h3>Projected cash position</h3>
              </div>
              <span>
                {forecast.range.from} – {forecast.range.to}
              </span>
            </header>
            {forecast.summary.projectedClosingBalance === null ? (
              <div className="cash-flow-empty">
                <strong>Opening balance needed</strong>
                <p>Configure an opening balance to chart the projected cash position.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chart}>
                  <defs>
                    <linearGradient id="cashBalance" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3178c6" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#3178c6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" minTickGap={28} />
                  <YAxis tickFormatter={(value) => money.format(Number(value))} />
                  <Tooltip formatter={(value) => money.format(Number(value))} />
                  <Area
                    type="monotone"
                    dataKey="closingBalance"
                    name="Closing balance"
                    stroke="#3178c6"
                    fill="url(#cashBalance)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </section>
          <div className="dashboard-chart-grid">
            <section className="panel dashboard-chart cash-flow-chart">
              <header>
                <div>
                  <span className="dashboard-chart-kicker">Movement</span>
                  <h3>Daily inflows and outflows</h3>
                </div>
              </header>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chart}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" minTickGap={24} />
                  <YAxis />
                  <Tooltip formatter={(value) => money.format(Number(value))} />
                  <Legend />
                  <Bar dataKey="inflows" name="Inflows" fill="#478d6d" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="outflows" name="Outflows" fill="#d97757" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </section>
            <section className="panel cash-flow-breakdown">
              <header>
                <div>
                  <span className="dashboard-chart-kicker">Sources</span>
                  <h3>Forecast breakdown</h3>
                </div>
              </header>
              {forecast.breakdown.length ? (
                forecast.breakdown.map((item) => (
                  <div className="cash-flow-breakdown-row" key={item.source}>
                    <span>{sourceLabel(item.source)}</span>
                    <strong>
                      {item.direction === "OUTFLOW" ? "−" : "+"}
                      {amount(item.amount)}
                    </strong>
                  </div>
                ))
              ) : (
                <div className="cash-flow-empty">
                  <strong>No forecast events</strong>
                  <p>Create or issue financial records to build a forecast.</p>
                </div>
              )}
            </section>
          </div>
          <section className="panel cash-flow-events">
            <header>
              <div>
                <span className="dashboard-chart-kicker">Timeline</span>
                <h3>Upcoming cash events</h3>
              </div>
              <span>{forecast.events.length} events</span>
            </header>
            {forecast.events.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Item</th>
                      <th>Source</th>
                      <th>Basis</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecast.events.slice(0, 100).map((event) => (
                      <tr key={event.id}>
                        <td>{event.date}</td>
                        <td>
                          <strong>{event.label}</strong>
                          {event.overdue && <span className="cash-flow-risk">Overdue</span>}
                        </td>
                        <td>{sourceLabel(event.source)}</td>
                        <td className="muted">{event.assumption ?? "Recorded obligation"}</td>
                        <td className={event.direction === "OUTFLOW" ? "negative" : "positive"}>
                          {event.direction === "OUTFLOW" ? "−" : "+"}
                          {amount(event.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="cash-flow-empty">
                <strong>No upcoming movement</strong>
                <p>No eligible records fall inside this forecast window.</p>
              </div>
            )}
          </section>
          <div className="cash-flow-notes">
            {forecast.warnings.map((warning) => (
              <p key={warning}>• {warning}</p>
            ))}
          </div>
        </>
      )}
      {settingsOpen && forecast && (
        <ConfigurationModal
          api={api}
          configuration={forecast.configuration}
          onClose={() => setSettingsOpen(false)}
          onSaved={() => {
            setSettingsOpen(false);
            onSaved("Cash flow settings updated.");
            setLoading(true);
            setRevision((value) => value + 1);
          }}
        />
      )}
    </div>
  );
}

function Kpi({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="dashboard-kpi">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function ConfigurationModal({
  api,
  configuration,
  onClose,
  onSaved,
}: {
  api: WorkspaceApi;
  configuration: Configuration;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    ...configuration,
    openingBalanceDate: configuration.openingBalanceDate?.slice(0, 10) ?? "",
    openingBalance: configuration.openingBalance ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState("");
  const update = (key: keyof typeof form, value: string | number | boolean) =>
    setForm((current) => ({ ...current, [key]: value }));
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFailure("");
    try {
      await api("/cash-flow/configuration", {
        method: "PATCH",
        body: {
          expectedVersion: configuration.version,
          openingBalance: form.openingBalance || null,
          openingBalanceDate: form.openingBalanceDate || null,
          defaultHorizonDays: form.defaultHorizonDays,
          expectedInvoiceCollectionDelay: form.expectedInvoiceCollectionDelay,
          conservativeDelayAdjustmentDays: form.conservativeDelayAdjustmentDays,
          optimisticDelayAdjustmentDays: form.optimisticDelayAdjustmentDays,
          includeRecurringInvoices: form.includeRecurringInvoices,
          includeApprovedPayroll: form.includeApprovedPayroll,
          includeSalaryEstimates: form.includeSalaryEstimates,
          includeApprovedExpenses: form.includeApprovedExpenses,
        },
      });
      onSaved();
    } catch (error) {
      setFailure(errorMessage(error));
      setSaving(false);
    }
  }
  return (
    <AppModal title="Cash flow settings" badge="Planning" onClose={onClose}>
      <form className="cash-flow-settings" onSubmit={submit}>
        <p className="muted">
          Set the assumptions used for your organization’s forecast. These settings never modify
          invoices, expenses, or payroll.
        </p>
        {failure && (
          <p className="alert" role="alert">
            {failure}
          </p>
        )}
        <div className="form-grid two-column">
          <label>
            Opening balance
            <input
              value={form.openingBalance}
              onChange={(e) => update("openingBalance", e.target.value)}
              inputMode="decimal"
              placeholder="Optional"
            />
          </label>
          <label>
            Balance as of
            <input
              type="date"
              value={form.openingBalanceDate}
              onChange={(e) => update("openingBalanceDate", e.target.value)}
            />
          </label>
          <label>
            Expected invoice delay (days)
            <input
              type="number"
              min="0"
              max="365"
              value={form.expectedInvoiceCollectionDelay}
              onChange={(e) => update("expectedInvoiceCollectionDelay", Number(e.target.value))}
            />
          </label>
          <label>
            Default horizon
            <select
              value={form.defaultHorizonDays}
              onChange={(e) => update("defaultHorizonDays", Number(e.target.value))}
            >
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
              <option value={90}>90 days</option>
              <option value={180}>6 months</option>
              <option value={365}>1 year</option>
            </select>
          </label>
          <label>
            Conservative extra delay
            <input
              type="number"
              min="0"
              max="365"
              value={form.conservativeDelayAdjustmentDays}
              onChange={(e) => update("conservativeDelayAdjustmentDays", Number(e.target.value))}
            />
          </label>
          <label>
            Optimistic delay
            <input
              type="number"
              min="0"
              max="365"
              value={form.optimisticDelayAdjustmentDays}
              onChange={(e) => update("optimisticDelayAdjustmentDays", Number(e.target.value))}
            />
          </label>
        </div>
        <fieldset className="cash-flow-options">
          <legend>Include in forecast</legend>
          {(
            [
              ["includeRecurringInvoices", "Recurring invoice projections"],
              ["includeApprovedPayroll", "Approved payroll before finalization"],
              ["includeSalaryEstimates", "Future salary estimates"],
              ["includeApprovedExpenses", "Approved future-dated expenses"],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={form[key]}
                onChange={(e) => update(key, e.target.checked)}
              />
              <span>
                <strong>{label}</strong>
                <small>
                  {key === "includeApprovedExpenses"
                    ? "Uses expense dates as a planning assumption."
                    : "Uses existing organization records only."}
                </small>
              </span>
            </label>
          ))}
        </fieldset>
        <div className="modal-form-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={saving}>
            {saving ? "Saving…" : "Save settings"}
          </button>
        </div>
      </form>
    </AppModal>
  );
}
