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
import { errorMessage, type WorkspaceApi } from "@/lib/api";
import { CashFlowKpi } from "./cash-flow-kpi";
import type { CashFlowForecast, CashFlowScenario } from "../types";
import { cashFlowChartData, cashFlowSourceLabel } from "../utils";
import { ForecastControls } from "./forecast-controls";
import { CashFlowSettingsDialog } from "./cash-flow-settings-dialog";

export default function CashFlowPage({
  api,
  permissions,
  onSaved,
}: {
  api: WorkspaceApi;
  permissions: readonly Permission[];
  onSaved: (message: string) => void;
}) {
  const [scenario, setScenario] = useState<CashFlowScenario>("EXPECTED");
  const [horizon, setHorizon] = useState(30);
  const [customHorizon, setCustomHorizon] = useState(false);
  const [forecast, setForecast] = useState<CashFlowForecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    api<CashFlowForecast>(`/cash-flow/forecast?horizonDays=${horizon}&scenario=${scenario}`, {
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
  const chart = forecast ? cashFlowChartData(forecast.daily) : [];

  if (loading && !forecast)
    return (
      <section className="panel dashboard-state">
        <span className="spinner" /> Loading cash flow forecast…
      </section>
    );
  return (
    <div className="cash-flow-page" data-tour="cash-flow-overview">
      <ForecastControls
        scenario={scenario}
        horizon={horizon}
        customHorizon={customHorizon}
        permissions={permissions}
        onScenarioChange={setScenario}
        onHorizonChange={setHorizon}
        onCustomChange={setCustomHorizon}
        onConfigure={() => setSettingsOpen(true)}
      />
      {failure && (
        <p className="alert" role="alert">
          {failure}
        </p>
      )}
      {forecast && (
        <>
          <div className="dashboard-kpi-grid cash-flow-kpis">
            <CashFlowKpi
              label="Expected inflows"
              value={amount(forecast.summary.projectedInflows)}
              detail={`${forecast.range.horizonDays}-day horizon`}
            />
            <CashFlowKpi
              label="Expected outflows"
              value={amount(forecast.summary.projectedOutflows)}
              detail="Payroll and enabled assumptions"
            />
            <CashFlowKpi
              label="Net movement"
              value={amount(forecast.summary.projectedNet)}
              detail={cashFlowSourceLabel(forecast.scenario)}
            />
            <CashFlowKpi
              label="Closing balance"
              value={amount(forecast.summary.projectedClosingBalance)}
              detail={
                forecast.summary.openingBalance === null
                  ? "Add an opening balance to calculate"
                  : `Starts at ${amount(forecast.summary.openingBalance)}`
              }
            />
            <CashFlowKpi
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
                    <span>{cashFlowSourceLabel(item.source)}</span>
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
                        <td>{cashFlowSourceLabel(event.source)}</td>
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
        <CashFlowSettingsDialog
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
