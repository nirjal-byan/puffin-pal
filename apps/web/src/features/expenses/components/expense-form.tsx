"use client";

import { useState, type FormEvent } from "react";
import { DatePicker } from "@/components/ui/date-picker";
import { Dropdown } from "@/components/ui/dropdown";
import { EXPENSE_CATEGORIES, type Expense } from "../types";
import { currentDate } from "../utils";

export function ExpenseForm({
  expense,
  busy,
  onSubmit,
  onCancel,
  onRemoveReceipt,
}: {
  expense: Expense | null;
  busy: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  onRemoveReceipt?: () => void;
}) {
  const [category, setCategory] = useState<string>(expense?.category ?? "OTHER");
  const [date, setDate] = useState(expense?.date.slice(0, 10) ?? currentDate());
  const [receiptName, setReceiptName] = useState("");

  return (
    <section className="form-panel expense-form">
      <form key={expense?.id ?? "new"} onSubmit={onSubmit}>
        <fieldset disabled={busy} className="form-fields">
          <label>
            Title
            <input
              name="title"
              required
              maxLength={160}
              defaultValue={expense?.title}
              placeholder="Software subscription"
            />
          </label>
          <label>
            Amount
            <input
              name="amount"
              required
              inputMode="decimal"
              pattern="[0-9]+([.][0-9]{1,2})?"
              defaultValue={expense?.amount}
              placeholder="0.00"
            />
          </label>
          <label>
            Category
            <Dropdown
              name="category"
              label="Category"
              value={category}
              onChange={setCategory}
              searchable={false}
              options={EXPENSE_CATEGORIES.map((value) => ({
                value,
                label: value.charAt(0) + value.slice(1).toLowerCase(),
              }))}
            />
          </label>
          <label>
            Expense date
            <DatePicker
              name="date"
              ariaLabel="Expense date"
              value={date}
              onChange={setDate}
              disabled={busy}
            />
          </label>
          <label>
            Vendor <span className="optional">optional</span>
            <input name="vendor" maxLength={160} defaultValue={expense?.vendor ?? ""} />
          </label>
          <label>
            Description <span className="optional">optional</span>
            <textarea
              name="description"
              maxLength={1000}
              defaultValue={expense?.description ?? ""}
            />
          </label>
          <label>
            Notes <span className="optional">optional</span>
            <textarea name="notes" maxLength={2000} defaultValue={expense?.notes ?? ""} />
          </label>
          <div className="expense-receipt-field">
            <span className="expense-field-label">
              Receipt <span className="optional">optional</span>
            </span>
            <label className="expense-upload">
              <input
                name="receipt"
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf"
                onChange={(event) => setReceiptName(event.target.files?.[0]?.name ?? "")}
              />
              <span className="expense-upload-icon" aria-hidden="true">
                ↥
              </span>
              <span>
                <strong>{receiptName || "Upload a receipt"}</strong>
                <small>
                  {receiptName ? "Ready to upload" : "JPEG, PNG, WebP or PDF · Up to 5 MB"}
                </small>
              </span>
              <span className="button secondary compact">Choose file</span>
            </label>
            {expense?.receiptName && (
              <span className="field-hint">Current receipt: {expense.receiptName}</span>
            )}
          </div>
          <div className="invoice-actions expense-form-actions">
            <button className="button secondary" type="button" onClick={onCancel}>
              Cancel
            </button>
            <button className="button primary" type="submit">
              {busy ? "Saving…" : expense ? "Save changes" : "Create expense"}
            </button>
            {onRemoveReceipt && (
              <button className="text-button danger-text" type="button" onClick={onRemoveReceipt}>
                Remove receipt
              </button>
            )}
          </div>
        </fieldset>
      </form>
    </section>
  );
}
