import type { Expense, ExpensePage } from "../types";

export interface ExpenseTablePermissions {
  create: boolean;
  update: boolean;
  delete: boolean;
  submit: boolean;
  approve: boolean;
}
export type ExpenseWorkflowAction = "submit" | "approve" | "reject" | "reopen";

export function ExpensesTable({
  page,
  loading,
  busy,
  pendingOnly,
  permissions,
  money,
  onPending,
  onDetails,
  onReceipt,
  onWorkflow,
  onEdit,
  onDelete,
}: {
  page: ExpensePage;
  loading: boolean;
  busy: boolean;
  pendingOnly: boolean;
  permissions: ExpenseTablePermissions;
  money: (amount: string) => string;
  onPending: () => void;
  onDetails: (expense: Expense) => void;
  onReceipt: (expense: Expense) => void;
  onWorkflow: (expense: Expense, action: ExpenseWorkflowAction) => void;
  onEdit: (expense: Expense) => void;
  onDelete: (expense: Expense) => void;
}) {
  return (
    <section className="panel" data-tour="expense-list">
      <div className="panel-heading">
        <h3>{pendingOnly ? "Pending approvals" : "Your expenses"}</h3>
        <span className="expense-heading-meta">
          <span className="muted">{page.total} total</span>
          {permissions.approve && page.pendingCount > 0 && (
            <button className="text-button" onClick={onPending}>
              {page.pendingCount} pending
            </button>
          )}
        </span>
      </div>
      {loading ? (
        <div className="loading" role="status">
          <span className="spinner" />
          Loading expenses…
        </div>
      ) : page.items.length === 0 ? (
        <div className="empty-state">
          <span className="empty-symbol">▤</span>
          <h3>No expenses found</h3>
          <p>
            {permissions.create
              ? "Create an expense or adjust your filters."
              : "No matching expenses are available."}
          </p>
        </div>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Expense</th>
                <th>Status</th>
                <th>Category</th>
                <th>Date</th>
                <th>Amount</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {page.items.map((expense) => (
                <tr key={expense.id}>
                  <td>
                    <strong>{expense.title}</strong>
                    <small>{expense.submittedBy?.fullName ?? expense.vendor ?? "—"}</small>
                  </td>
                  <td>
                    <span className={`expense-status ${expense.approvalStatus.toLowerCase()}`}>
                      {expense.approvalStatus.replaceAll("_", " ").toLowerCase()}
                    </span>
                  </td>
                  <td>
                    <span className="role-badge">{expense.category.toLowerCase()}</span>
                  </td>
                  <td>{expense.date.slice(0, 10)}</td>
                  <td>
                    <strong>{money(expense.amount)}</strong>
                  </td>
                  <td>
                    <div className="client-row-actions">
                      <button className="text-button" onClick={() => onDetails(expense)}>
                        View
                      </button>
                      {expense.receiptName && (
                        <button
                          className="text-button"
                          disabled={busy}
                          onClick={() => onReceipt(expense)}
                        >
                          Receipt
                        </button>
                      )}
                      {permissions.submit && expense.approvalStatus === "DRAFT" && (
                        <button
                          className="text-button"
                          disabled={busy}
                          onClick={() => onWorkflow(expense, "submit")}
                        >
                          Submit
                        </button>
                      )}
                      {permissions.approve && expense.approvalStatus === "PENDING_APPROVAL" && (
                        <>
                          <button
                            className="text-button"
                            disabled={busy}
                            onClick={() => onWorkflow(expense, "approve")}
                          >
                            Approve
                          </button>
                          <button
                            className="text-button danger-text"
                            disabled={busy}
                            onClick={() => onWorkflow(expense, "reject")}
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {permissions.submit && expense.approvalStatus === "REJECTED" && (
                        <button
                          className="text-button"
                          disabled={busy}
                          onClick={() => onWorkflow(expense, "reopen")}
                        >
                          Revise
                        </button>
                      )}
                      {permissions.update && expense.approvalStatus === "DRAFT" && (
                        <button
                          className="text-button"
                          disabled={busy}
                          onClick={() => onEdit(expense)}
                        >
                          Edit
                        </button>
                      )}
                      {permissions.delete && expense.approvalStatus === "DRAFT" && (
                        <button
                          className="text-button danger-text"
                          disabled={busy}
                          onClick={() => onDelete(expense)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
