import type { Expense } from "../types";

export function ExpenseDetails({
  expense,
  money,
  onClose,
  onReceipt,
}: {
  expense: Expense;
  money: (amount: string) => string;
  onClose: () => void;
  onReceipt: (expense: Expense, download?: boolean) => void;
}) {
  return (
    <section className="panel expense-details">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Expense details</span>
          <h3>{expense.title}</h3>
        </div>
        <button className="text-button" onClick={onClose} aria-label="Close expense details">
          ×
        </button>
      </div>
      <dl>
        <dt>Status</dt>
        <dd>
          <span className={`expense-status ${expense.approvalStatus.toLowerCase()}`}>
            {expense.approvalStatus.replaceAll("_", " ").toLowerCase()}
          </span>
        </dd>
        <dt>Amount</dt>
        <dd>{money(expense.amount)}</dd>
        <dt>Date</dt>
        <dd>{expense.date.slice(0, 10)}</dd>
        <dt>Category</dt>
        <dd>{expense.category.toLowerCase()}</dd>
        <dt>Vendor</dt>
        <dd>{expense.vendor || "—"}</dd>
        <dt>Description</dt>
        <dd>{expense.description || "—"}</dd>
        <dt>Notes</dt>
        <dd>{expense.notes || "—"}</dd>
        <dt>Submitted by</dt>
        <dd>{expense.submittedBy?.fullName ?? "—"}</dd>
        <dt>Submitted</dt>
        <dd>{expense.submittedAt ? new Date(expense.submittedAt).toLocaleString() : "—"}</dd>
        <dt>Reviewed by</dt>
        <dd>{expense.reviewedBy?.fullName ?? "—"}</dd>
        <dt>Reviewed</dt>
        <dd>{expense.reviewedAt ? new Date(expense.reviewedAt).toLocaleString() : "—"}</dd>
        {expense.rejectionReason && (
          <>
            <dt>Rejection reason</dt>
            <dd className="expense-rejection">{expense.rejectionReason}</dd>
          </>
        )}
        <dt>Receipt</dt>
        <dd>
          {expense.receiptName ? (
            <span className="receipt-actions">
              <button className="text-button" onClick={() => onReceipt(expense)}>
                Preview
              </button>
              <button className="text-button" onClick={() => onReceipt(expense, true)}>
                Download
              </button>
            </span>
          ) : (
            "None"
          )}
        </dd>
      </dl>
      {expense.approvalHistory && expense.approvalHistory.length > 0 && (
        <div className="expense-history">
          <h4>Approval history</h4>
          <ol>
            {expense.approvalHistory.map((event) => (
              <li key={event.id}>
                <span />
                <div>
                  <strong>{event.action.replaceAll("_", " ").toLowerCase()}</strong>
                  <small>
                    {event.actor?.fullName ?? "Former member"} ·{" "}
                    {new Date(event.createdAt).toLocaleString()}
                  </small>
                  {event.rejectionReason && <p>{event.rejectionReason}</p>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
