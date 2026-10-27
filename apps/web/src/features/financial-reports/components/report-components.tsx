import type { ReactNode } from "react";

export function CurrencyDisplay({ currency, value }: { currency: string; value: string }) {
  return (
    <>{new Intl.NumberFormat(undefined, { style: "currency", currency }).format(Number(value))}</>
  );
}

export function ReportSummaryCard({
  label,
  value,
  note,
}: {
  label: string;
  value: ReactNode;
  note: string;
}) {
  return (
    <article className="report-summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

export function ReportEmptyState({ children }: { children: ReactNode }) {
  return <div className="report-empty-state">{children}</div>;
}

export function ReportDataTable({
  caption,
  labelKey,
  rows,
  currency,
}: {
  caption: string;
  labelKey: string;
  rows: Array<Record<string, string | number>>;
  currency: string;
}) {
  if (!rows.length)
    return <ReportEmptyState>No records in this reporting period.</ReportEmptyState>;
  return (
    <div className="report-table-wrap">
      <table className="report-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{caption}</th>
            <th scope="col">Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${String(row[labelKey])}-${index}`}>
              <th scope="row">{String(row[labelKey])}</th>
              <td>
                <CurrencyDisplay currency={currency} value={String(row.amount)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ReportChart({
  rows,
  currency,
}: {
  rows: Array<{ period: string; invoiced: string; expenses: string; payroll: string }>;
  currency: string;
}) {
  const maximum = Math.max(
    1,
    ...rows.flatMap((row) => [Number(row.invoiced), Number(row.expenses) + Number(row.payroll)]),
  );
  if (!rows.length)
    return <ReportEmptyState>No activity to chart in this period.</ReportEmptyState>;
  return (
    <div>
      <div
        className="report-chart"
        role="img"
        aria-label="Issued revenue and supported operating costs by period"
      >
        {rows.map((row) => {
          const costs = Number(row.expenses) + Number(row.payroll);
          return (
            <div
              className="report-chart-group"
              key={row.period}
              title={`${row.period}: revenue ${row.invoiced}; costs ${costs.toFixed(2)}`}
            >
              <div className="report-chart-bars">
                <span
                  className="revenue"
                  style={{ height: `${Math.max(2, (Number(row.invoiced) / maximum) * 100)}%` }}
                />
                <span
                  className="cost"
                  style={{ height: `${Math.max(2, (costs / maximum) * 100)}%` }}
                />
              </div>
              <small>{row.period.slice(0, 7)}</small>
            </div>
          );
        })}
      </div>
      <details className="report-chart-alternative">
        <summary>View chart data</summary>
        <table className="report-table">
          <thead>
            <tr>
              <th>Period</th>
              <th>Revenue</th>
              <th>Costs</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.period}>
                <th>{row.period}</th>
                <td>
                  <CurrencyDisplay currency={currency} value={row.invoiced} />
                </td>
                <td>
                  <CurrencyDisplay
                    currency={currency}
                    value={(Number(row.expenses) + Number(row.payroll)).toFixed(2)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
