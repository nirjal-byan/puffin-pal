"use client";
import type { InvoiceLine } from "../types/invoice.types";
import { formatCents, lineAmount, MAX_ITEMS } from "../schemas/invoice.schema";
export function InvoiceLineItems({
  items,
  onChange,
  onAdd,
  onRemove,
  errors,
  disabled,
}: {
  items: InvoiceLine[];
  onChange: (id: string, patch: Partial<InvoiceLine>) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  errors: Record<string, string>;
  disabled: boolean;
}) {
  return (
    <section className="panel invoice-section">
      <div className="panel-heading">
        <h3>Line items</h3>
        <span className="muted">
          {items.length} / {MAX_ITEMS}
        </span>
      </div>
      <div className="invoice-lines">
        {items.map((line, index) => {
          const amount = lineAmount(line);
          return (
            <div className="invoice-line" key={line.id}>
              <span className="invoice-line-number">
                {String(index + 1).padStart(2, "0")}
              </span>
              {(["description", "quantity", "unitPrice"] as const).map(
                (field) => (
                  <label
                    className={`invoice-field invoice-${field}`}
                    key={field}
                  >
                    {field === "description"
                      ? "Description"
                      : field === "quantity"
                        ? "Quantity"
                        : "Unit price"}
                    <input
                      name={field}
                      data-tour-suggestion={field === "description" ? "Website design" : field === "quantity" ? "1" : "500.00"}
                      onKeyDown={(event) => {
                        const suggestion = field === "description" ? "Website design" : field === "quantity" ? "1" : "500.00";
                        if (event.key === "Tab" && !event.shiftKey && (!line[field] || (field === "unitPrice" && line[field] === "0.00"))) {
                          event.preventDefault(); onChange(line.id, { [field]: suggestion });
                        }
                      }}
                      value={line[field]}
                      onChange={(event) =>
                        onChange(line.id, { [field]: event.target.value })
                      }
                      disabled={disabled}
                      aria-label={`${field === "unitPrice" ? "Unit price" : field === "quantity" ? "Quantity" : "Description"} ${index + 1}`}
                      aria-invalid={Boolean(errors[`${line.id}.${field}`])}
                      aria-describedby={
                        errors[`${line.id}.${field}`]
                          ? `${line.id}-${field}-error`
                          : undefined
                      }
                      maxLength={
                        field === "description"
                          ? 1000
                          : field === "quantity"
                            ? 10
                            : 13
                      }
                      inputMode={
                        field === "unitPrice"
                          ? "decimal"
                          : field === "quantity"
                            ? "numeric"
                            : "text"
                      }
                      placeholder={
                        field === "description"
                          ? "Service or product"
                          : undefined
                      }
                    />
                    {errors[`${line.id}.${field}`] && (
                      <span
                        id={`${line.id}-${field}-error`}
                        className="invoice-field-error"
                      >
                        {errors[`${line.id}.${field}`]}
                      </span>
                    )}
                  </label>
                ),
              )}
              <div className="invoice-line-amount">
                <span>Amount</span>
                <output aria-label={`Amount ${index + 1}`}>
                  {amount === null ? "—" : formatCents(amount)}
                </output>
                {errors[`${line.id}.amount`] && (
                  <span className="invoice-field-error">
                    {errors[`${line.id}.amount`]}
                  </span>
                )}
              </div>
              <button
                type="button"
                className="invoice-remove"
                disabled={disabled || items.length === 1}
                aria-label={`Remove item ${index + 1}`}
                title={
                  items.length === 1 ? "Keep at least one item" : "Remove item"
                }
                onClick={() => onRemove(line.id)}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
      <div className="invoice-lines-footer">
        <button
          type="button"
          className="button secondary"
          disabled={disabled || items.length >= MAX_ITEMS}
          onClick={onAdd}
        >
          + Add line item
        </button>
        <span className="muted">
          Whole quantities · Prices up to 2 decimal places
        </span>
      </div>
      {errors.items && (
        <p className="invoice-field-error invoice-errors-padding">
          {errors.items}
        </p>
      )}
    </section>
  );
}
