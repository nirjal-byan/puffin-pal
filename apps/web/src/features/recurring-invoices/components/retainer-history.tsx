import type { RecurringOccurrence } from "../types";

export function RetainerHistory({
  occurrences,
  onRetry,
}: {
  occurrences: RecurringOccurrence[];
  onRetry: (occurrence: RecurringOccurrence) => void;
}) {
  if (!occurrences.length) return null;
  return (
    <section className="recurring-history">
      <h4>Generated invoices</h4>
      {occurrences.map((occurrence) => (
        <div key={occurrence.id}>
          <span>
            {new Date(occurrence.scheduledFor).toLocaleDateString()} · {occurrence.status}
          </span>
          {occurrence.invoiceId && (
            <a className="text-button" href={`/invoices/${occurrence.invoiceId}`}>
              View invoice ↗
            </a>
          )}
          {occurrence.status === "FAILED" && (
            <button type="button" className="text-button" onClick={() => onRetry(occurrence)}>
              Retry
            </button>
          )}
        </div>
      ))}
    </section>
  );
}
