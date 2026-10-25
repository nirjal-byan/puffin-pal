import type { ReactNode } from "react";

export function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail: string;
}) {
  return (
    <article className="workforce-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}
export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`status-badge status-${status.toLowerCase().replaceAll("_", "-")}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}
export function WorkforceEmpty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="empty-state workforce-empty">
      <span className="empty-symbol">◷</span>
      <h3>{title}</h3>
      <p>{detail}</p>
    </div>
  );
}
