import type { PaymentBatch, PaymentBatchItem } from "./types";

export function PaymentBatchesPanel({
  batches,
  canManage,
  onUpdateItem,
}: {
  batches: PaymentBatch[];
  canManage: boolean;
  onUpdateItem: (
    batch: PaymentBatch,
    item: PaymentBatchItem,
    status: PaymentBatchItem["status"],
  ) => void;
}) {
  return (
    <section className="banking-batches">
      {batches.map((batch) => (
        <article className="panel banking-batch" key={batch.id}>
          <header>
            <div>
              <span className="eyebrow">{batch.status}</span>
              <h3>{batch.name}</h3>
            </div>
            <strong>
              {batch.currency} {batch.totalAmount}
            </strong>
          </header>
          <div>
            {batch.items.map((item) => (
              <div className="banking-batch-item" key={item.id}>
                <span>{item.employeeName}</span>
                <span>
                  {batch.currency} {item.amount}
                </span>
                <span className={`status-pill ${item.status === "PAID" ? "matched" : "pending"}`}>
                  {item.status}
                </span>
                {canManage && item.status !== "PAID" && (
                  <div className="batch-item-actions">
                    {(["ATTEMPTED", "PAID", "FAILED"] as const).map((status) => (
                      <button
                        key={status}
                        className="text-button"
                        onClick={() => onUpdateItem(batch, item, status)}
                      >
                        {status === "PAID"
                          ? "Mark paid"
                          : status[0] + status.slice(1).toLowerCase()}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </article>
      ))}
      {!batches.length && (
        <section className="panel empty-state">
          <h3>No payment batches</h3>
          <p>Group finalized payroll obligations into a controlled payment checklist.</p>
        </section>
      )}
    </section>
  );
}
