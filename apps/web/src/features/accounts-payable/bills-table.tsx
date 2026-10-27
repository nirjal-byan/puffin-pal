import { PAYABLE_PAGE_SIZE } from "./constants";
import type { VendorBill } from "./types";
export function BillsTable({
  bills,
  total,
  page,
  loading,
  vendorNames,
  canManage,
  canApprove,
  canPay,
  onPage,
  onTransition,
  onPay,
}: {
  bills: VendorBill[];
  total: number;
  page: number;
  loading: boolean;
  vendorNames: Map<string, string>;
  canManage: boolean;
  canApprove: boolean;
  canPay: boolean;
  onPage: (page: number) => void;
  onTransition: (bill: VendorBill, action: string) => void;
  onPay: (bill: VendorBill) => void;
}) {
  return (
    <section className="panel ap-table-panel">
      <header>
        <div>
          <h3>Vendor bills</h3>
          <p>Approval and settlement are shown independently.</p>
        </div>
        <span>{total} total</span>
      </header>
      <div className="table-scroll">
        <table className="ap-table">
          <thead>
            <tr>
              <th>Bill</th>
              <th>Vendor</th>
              <th>Due</th>
              <th>Approval</th>
              <th>Payment</th>
              <th className="number">Balance</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {bills.map((bill) => (
              <tr key={bill.id}>
                <td>
                  <strong>{bill.billNumber}</strong>
                  <small>
                    {bill.currency} {bill.totalAmount}
                  </small>
                </td>
                <td>{vendorNames.get(bill.vendorId) ?? "Vendor"}</td>
                <td className={bill.overdue ? "danger-text" : ""}>{bill.dueDate.slice(0, 10)}</td>
                <td>
                  <span className="status-pill">{bill.status.replaceAll("_", " ")}</span>
                </td>
                <td>
                  <span className="status-pill neutral">
                    {bill.settlementStatus.replaceAll("_", " ")}
                  </span>
                </td>
                <td className="number">
                  <strong>{bill.balance}</strong>
                </td>
                <td>
                  <div className="row-actions">
                    {bill.status === "DRAFT" && canManage && (
                      <button
                        className="button secondary compact"
                        onClick={() => onTransition(bill, "submit")}
                      >
                        Submit
                      </button>
                    )}
                    {bill.status === "PENDING_APPROVAL" && canApprove && (
                      <button
                        className="button secondary compact"
                        onClick={() => onTransition(bill, "approve")}
                      >
                        Approve
                      </button>
                    )}
                    {bill.status === "APPROVED" && bill.settlementStatus !== "PAID" && canPay && (
                      <button className="button primary compact" onClick={() => onPay(bill)}>
                        Pay
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!total && !loading && (
              <tr>
                <td colSpan={7} className="empty-cell">
                  No vendor bills match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {total > PAYABLE_PAGE_SIZE && (
        <footer className="ap-pagination">
          <span>
            {page * PAYABLE_PAGE_SIZE + 1}–{Math.min((page + 1) * PAYABLE_PAGE_SIZE, total)} of{" "}
            {total}
          </span>
          <div className="row-actions">
            <button
              className="button secondary compact"
              disabled={page === 0}
              onClick={() => onPage(Math.max(0, page - 1))}
            >
              Previous
            </button>
            <button
              className="button secondary compact"
              disabled={(page + 1) * PAYABLE_PAGE_SIZE >= total}
              onClick={() => onPage(page + 1)}
            >
              Next
            </button>
          </div>
        </footer>
      )}
    </section>
  );
}
