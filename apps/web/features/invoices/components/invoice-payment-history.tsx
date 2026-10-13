import type { InvoiceDetail } from "../types/invoice.types";
import { PAYMENT_METHODS } from "../schemas/payment.schema";

export function InvoicePaymentHistory({ invoice }: { invoice: InvoiceDetail }) {
  return (
    <section className="panel invoice-payment-history">
      <div className="panel-heading" data-tour="payment-history"><h3>Payment history</h3><span className="muted">{invoice.payments.length} recorded</span></div>
      {invoice.legacyPaid && <p className="muted payment-history-note">This invoice was already marked paid before payment tracking. No historical payment entries were created.</p>}
      {invoice.payments.length ? <div className="table-scroll"><table>
        <thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Reference</th><th>Notes</th></tr></thead>
        <tbody>{invoice.payments.map((payment) => <tr key={payment.id}>
          <td>{payment.paymentDate.slice(0, 10)}</td><td>{invoice.currency} {payment.amount}</td>
          <td>{PAYMENT_METHODS.find((method) => method.value === payment.method)?.label ?? payment.method}</td>
          <td className="payment-reference">{payment.reference || "—"}</td><td className="payment-notes">{payment.notes || "—"}</td>
        </tr>)}</tbody>
      </table></div> : !invoice.legacyPaid && <p className="muted payment-history-note">No payments recorded yet.</p>}
    </section>
  );
}
