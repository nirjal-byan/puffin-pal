import type { PayablesSummary as Summary } from "./types";
export function PayablesSummary({ summary }: { summary: Summary }) {
  return (
    <section className="ap-metrics">
      <article className="panel">
        <span>Outstanding</span>
        <strong>{summary.outstanding}</strong>
      </article>
      <article className="panel">
        <span>Overdue</span>
        <strong>{summary.overdue}</strong>
      </article>
      <article className="panel">
        <span>Due in 30 days</span>
        <strong>{summary.aging.days1to30}</strong>
      </article>
      <article className="panel">
        <span>Over 90 days</span>
        <strong>{summary.aging.over90}</strong>
      </article>
    </section>
  );
}
