import { Dropdown } from "@/components/ui/dropdown";
import type { BankAccount, BankTransaction } from "../types";

export function BankTransactionsTable({
  transactions,
  total,
  accounts,
  search,
  status,
  canReconcile,
  onSearchChange,
  onStatusChange,
  onMatch,
  onReverse,
}: {
  transactions: BankTransaction[];
  total: number;
  accounts: Map<string, BankAccount>;
  search: string;
  status: string;
  canReconcile: boolean;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onMatch: (transaction: BankTransaction) => void;
  onReverse: (transaction: BankTransaction) => void;
}) {
  return (
    <section className="panel banking-table-panel">
      <header>
        <div>
          <h3>Statement transactions</h3>
          <p>Imported bank activity and its reconciliation status.</p>
        </div>
        <span>{total} records</span>
      </header>
      <div className="banking-filters">
        <input
          aria-label="Search transactions"
          placeholder="Search description, reference, or account"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
        <Dropdown
          name="transaction-status"
          label="Reconciliation status"
          searchable={false}
          value={status}
          onChange={onStatusChange}
          options={[
            { value: "ALL", label: "All statuses" },
            { value: "MATCHED", label: "Matched" },
            { value: "UNMATCHED", label: "Unmatched" },
          ]}
        />
      </div>
      <div className="table-scroll">
        <table className="banking-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Account</th>
              <th>Amount</th>
              <th>Status</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {transactions.map((row) => (
              <tr key={row.id}>
                <td>{new Date(row.transactionDate).toLocaleDateString()}</td>
                <td>
                  <strong>{row.description}</strong>
                  <small>{row.reference || "No reference"}</small>
                </td>
                <td>{accounts.get(row.bankAccountId)?.displayName ?? "Bank account"}</td>
                <td className={row.direction === "CREDIT" ? "money-in" : "money-out"}>
                  {row.direction === "CREDIT" ? "+" : "−"}
                  {row.currency} {row.amount}
                </td>
                <td>
                  <span className={`status-pill ${row.reconciliation ? "matched" : "pending"}`}>
                    {row.reconciliation ? "Matched" : "Unmatched"}
                  </span>
                </td>
                <td>
                  {canReconcile &&
                    (row.reconciliation ? (
                      <button className="text-button" onClick={() => onReverse(row)}>
                        Reverse
                      </button>
                    ) : (
                      <button className="button secondary compact" onClick={() => onMatch(row)}>
                        Match
                      </button>
                    ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!total && (
        <div className="empty-state">
          <h3>No imported transactions</h3>
          <p>Import a CSV bank statement to begin reconciliation.</p>
        </div>
      )}
    </section>
  );
}
