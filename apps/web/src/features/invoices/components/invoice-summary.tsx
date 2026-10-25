import { invoicePreview } from "../schemas/invoice.schema";
import type { InvoiceLine } from "../types/invoice.types";
export function InvoiceSummary({ items }: { items: InvoiceLine[] }) {
  const subtotal = invoicePreview(items);
  return (
    <section className="panel invoice-summary">
      <span className="eyebrow">Invoice summary</span>
      <h3>Draft totals</h3>
      <dl>
        <div>
          <dt>Subtotal</dt>
          <dd aria-label="Invoice subtotal">{subtotal ?? "—"}</dd>
        </div>
        <div>
          <dt>Tax</dt>
          <dd>0.00</dd>
        </div>
        <div className="invoice-grand-total">
          <dt>Total</dt>
          <dd aria-label="Invoice total">{subtotal ?? "—"}</dd>
        </div>
      </dl>
      <p className="field-hint">
        Final totals are calculated when your draft is saved. No taxes or discounts are applied.
      </p>
    </section>
  );
}
