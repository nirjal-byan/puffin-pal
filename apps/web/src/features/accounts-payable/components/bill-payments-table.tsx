import type { Permission } from "@puffinpal/permissions";
import { formatExpenseMoney } from "@/features/expenses/utils";
import { canReversePayment } from "../services/bill-workflow-api";
import type { PayablePayment } from "../types";

export function BillPaymentsTable({
  payments,
  permissions,
  busy,
  onReverse,
}: {
  payments: PayablePayment[];
  permissions: readonly Permission[];
  busy: boolean;
  onReverse: (payment: PayablePayment) => void;
}) {
  if (!payments.length) return <p>No payments recorded for this bill.</p>;
  return (
    <div className="table-scroll">
      <table className="ap-table">
        <caption>Bill payment history</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>Amount</th>
            <th>Method / reference</th>
            <th>Status / audit</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((payment) => (
            <tr key={payment.id}>
              <td>{payment.paymentDate.slice(0, 10)}</td>
              <td>{formatExpenseMoney(payment.amount, payment.currency)}</td>
              <td>
                {payment.method.replaceAll("_", " ")}
                <small>{payment.reference || "No reference"}</small>
                {payment.notes && <small>{payment.notes}</small>}
              </td>
              <td>
                <span className={`status-pill${payment.reversedAt ? " neutral" : ""}`}>
                  {payment.reversedAt ? "Reversed" : "Recorded"}
                </span>
                <small>
                  Recorded {payment.createdAt.slice(0, 10)} · User {payment.recordedById}
                </small>
                {payment.reversedAt && (
                  <>
                    <small>
                      Reversed {payment.reversedAt.slice(0, 10)} · User {payment.reversedById}
                    </small>
                    <small>Reason: {payment.reversalReason || "Not provided"}</small>
                  </>
                )}
              </td>
              <td>
                {canReversePayment(payment, permissions) && (
                  <button
                    className="button secondary compact"
                    disabled={busy}
                    onClick={() => onReverse(payment)}
                  >
                    Reverse payment
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
