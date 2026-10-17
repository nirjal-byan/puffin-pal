"use client";
import type { Permission } from "@puffinpal/permissions";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { errorMessage, type WorkspaceApi } from "../../../lib/api";
import { validateExpense, validateReceiptFile } from "../../expenses/schemas/expense.schema";
import { AppModal } from "../../../components/app-modal";
import { DatePicker } from "../../../components/date-picker";
import { Dropdown } from "../../../components/dropdown";

const CATEGORIES = ["SOFTWARE", "HARDWARE", "TRAVEL", "MARKETING", "OTHER"] as const;
type Expense = { id: string; title: string; description: string | null; amount: string; category: typeof CATEGORIES[number]; vendor: string | null; notes: string | null; receiptName: string | null; receiptMime: string | null; receiptSize: number | null; date: string; createdAt: string; updatedAt: string };
type ExpensePage = { items: Expense[]; total: number; limit: number; offset: number };
const today = () => new Date().toISOString().slice(0, 10);

export default function ExpensesPage({ api, currency, permissions, onSaved, onError }: { api: WorkspaceApi; currency: string; permissions: readonly Permission[]; onSaved: (message: string) => void; onError: (error: unknown) => void }) {
  const canCreate = permissions.includes("expenses:create"), canUpdate = permissions.includes("expenses:update"), canDelete = permissions.includes("expenses:delete");
  const [page, setPage] = useState<ExpensePage>({ items: [], total: 0, limit: 20, offset: 0 });
  const [offset, setOffset] = useState(0);
  const [filters, setFilters] = useState({ search: "", category: "", from: "", to: "", sort: "date", order: "desc" });
  const [applied, setApplied] = useState(filters);
  const [editing, setEditing] = useState<Expense | null>(null), [creating, setCreating] = useState(false), [deleting, setDeleting] = useState<Expense | null>(null);
  const [selected, setSelected] = useState<Expense | null>(null);
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [failure, setFailure] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const load = useCallback(async () => {
    setLoading(true); setFailure("");
    const query = new URLSearchParams({ limit: "20", offset: String(offset), sort: applied.sort, order: applied.order });
    for (const [key, value] of Object.entries(applied)) if (value && !["sort", "order"].includes(key)) query.set(key, value);
    try { setPage(await api<ExpensePage>(`/expenses?${query}`)); } catch (error) { setFailure(errorMessage(error)); } finally { setLoading(false); }
  }, [api, applied, offset]);
  // Loading is intentionally tied to the applied filters and page offset.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (deleting) dialog.current?.showModal(); else dialog.current?.close(); }, [deleting]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget), receipt = data.get("receipt");
    setBusy(true); setFailure("");
    try {
      const payload = { title: String(data.get("title")), description: String(data.get("description")), amount: String(data.get("amount")), category: String(data.get("category")), date: String(data.get("date")), vendor: String(data.get("vendor")), notes: String(data.get("notes")) };
      const invalid = validateExpense(payload) || (receipt instanceof File && receipt.size ? validateReceiptFile(receipt) : "");
      if (invalid) throw new Error(invalid);
      const saved = await api<Expense>(editing ? `/expenses/${editing.id}` : "/expenses", { method: editing ? "PATCH" : "POST", body: payload });
      if (receipt instanceof File && receipt.size) { const upload = new FormData(); upload.set("receipt", receipt); await api(`/expenses/${saved.id}/receipt`, { method: "PUT", body: upload }); }
      setEditing(null); setCreating(false); setSelected(null); onSaved(editing ? "Expense updated." : "Expense added."); await load();
    } catch (error) { setFailure(errorMessage(error)); onError(error); } finally { setBusy(false); }
  }
  async function openReceipt(expense: Expense, download = false) {
    setBusy(true);
    try { const blob = await api<Blob>(`/expenses/${expense.id}/receipt`, { responseType: "file" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; if (download) link.download = expense.receiptName ?? "receipt"; else { link.target = "_blank"; link.rel = "noopener"; } link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    catch (error) { onError(error); } finally { setBusy(false); }
  }
  async function removeReceipt(expense: Expense) { setBusy(true); try { await api(`/expenses/${expense.id}/receipt`, { method: "DELETE" }); onSaved("Receipt removed."); setEditing(null); await load(); } catch (error) { onError(error); } finally { setBusy(false); } }
  async function removeExpense() { if (!deleting) return; setBusy(true); try { await api(`/expenses/${deleting.id}`, { method: "DELETE" }); setDeleting(null); onSaved("Expense deleted."); await load(); } catch (error) { setFailure(errorMessage(error)); } finally { setBusy(false); } }
  const money = (value: string) => { try { return new Intl.NumberFormat("en", { style: "currency", currency }).format(Number(value)); } catch { return `${currency} ${value}`; } };
  return <div className="expense-manager">
    <section className="panel expense-filters"><form onSubmit={(event) => { event.preventDefault(); setOffset(0); setApplied(filters); }}>
      <label>Search<input value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} placeholder="Title, vendor or notes" /></label>
      <label>Category<select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}><option value="">All categories</option>{CATEGORIES.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>From<input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} /></label>
      <label>To<input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} /></label>
      <label>Sort<select value={`${filters.sort}:${filters.order}`} onChange={(e) => { const [sort, order] = e.target.value.split(":"); setFilters({ ...filters, sort: sort!, order: order! }); }}><option value="date:desc">Newest expense</option><option value="date:asc">Oldest expense</option><option value="amount:desc">Highest amount</option><option value="amount:asc">Lowest amount</option><option value="title:asc">Title A–Z</option></select></label>
      <button className="button secondary" type="submit">Apply filters</button>{canCreate && <button className="button primary" type="button" onClick={() => { setEditing(null); setCreating(true); }}>+ Create Expense</button>}
    </form></section>
    {(creating || editing) && <AppModal title={editing ? "Edit expense" : "Create expense"} onClose={() => { if (!busy) { setCreating(false); setEditing(null); } }}>
      <ExpenseForm expense={editing} busy={busy} onSubmit={save} onCancel={() => { setCreating(false); setEditing(null); }} onRemoveReceipt={canUpdate && editing?.receiptName ? () => void removeReceipt(editing) : undefined} />
    </AppModal>}
    {failure && <p className="alert" role="alert">{failure}</p>}
    <section className="panel"><div className="panel-heading"><h3>Your expenses</h3><span className="muted">{page.total} total</span></div>
      {loading ? <div className="loading" role="status"><span className="spinner" />Loading expenses…</div> : page.items.length === 0 ? <div className="empty-state"><span className="empty-symbol">▤</span><h3>No expenses found</h3><p>{canCreate ? "Create an expense or adjust your filters." : "No matching expenses are available."}</p></div> : <div className="table-scroll"><table><thead><tr><th>Expense</th><th>Vendor</th><th>Category</th><th>Date</th><th>Amount</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{page.items.map((expense) => <tr key={expense.id}><td><strong>{expense.title}</strong>{expense.description && <small>{expense.description}</small>}</td><td>{expense.vendor || "—"}</td><td><span className="role-badge">{expense.category.toLowerCase()}</span></td><td>{expense.date.slice(0, 10)}</td><td><strong>{money(expense.amount)}</strong></td><td><div className="client-row-actions"><button className="text-button" onClick={() => setSelected(selected?.id === expense.id ? null : expense)}>View</button>{expense.receiptName && <button className="text-button" disabled={busy} onClick={() => void openReceipt(expense)}>Receipt</button>}{canUpdate && <button className="text-button" disabled={busy} onClick={() => { setCreating(false); setEditing(expense); }}>Edit</button>}{canDelete && <button className="text-button danger-text" disabled={busy} onClick={() => setDeleting(expense)}>Delete</button>}</div></td></tr>)}</tbody></table></div>}
    </section>
    {selected && <section className="panel expense-details"><div className="panel-heading"><div><span className="eyebrow">Expense details</span><h3>{selected.title}</h3></div><button className="text-button" onClick={() => setSelected(null)} aria-label="Close expense details">×</button></div><dl><dt>Amount</dt><dd>{money(selected.amount)}</dd><dt>Date</dt><dd>{selected.date.slice(0, 10)}</dd><dt>Category</dt><dd>{selected.category.toLowerCase()}</dd><dt>Vendor</dt><dd>{selected.vendor || "—"}</dd><dt>Description</dt><dd>{selected.description || "—"}</dd><dt>Notes</dt><dd>{selected.notes || "—"}</dd><dt>Receipt</dt><dd>{selected.receiptName ? <span className="receipt-actions"><button className="text-button" onClick={() => void openReceipt(selected)}>Preview</button><button className="text-button" onClick={() => void openReceipt(selected, true)}>Download</button></span> : "None"}</dd></dl></section>}
    <div className="pagination"><span>{page.total ? `Showing ${page.offset + 1}–${Math.min(page.offset + page.items.length, page.total)} of ${page.total}` : "No records"}</span><div><button className="button secondary compact" disabled={offset === 0 || loading} onClick={() => setOffset(Math.max(0, offset - 20))}>← Previous</button><button className="button secondary compact" disabled={offset + page.items.length >= page.total || loading} onClick={() => setOffset(offset + 20)}>Next →</button></div></div>
    <dialog ref={dialog} className="invoice-delete-dialog" onCancel={(e) => { e.preventDefault(); if (!busy) setDeleting(null); }} onClose={() => setDeleting(null)}><h2>Delete expense?</h2><p><strong>{deleting?.title}</strong></p><p>This permanently deletes the expense and its receipt.</p><div className="invoice-actions"><button autoFocus className="button secondary" disabled={busy} onClick={() => setDeleting(null)}>Cancel</button><button className="button danger" disabled={busy} onClick={() => void removeExpense()}>{busy ? "Deleting…" : "Delete permanently"}</button></div></dialog>
  </div>;
}

function ExpenseForm({ expense, busy, onSubmit, onCancel, onRemoveReceipt }: { expense: Expense | null; busy: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void; onRemoveReceipt?: () => void }) {
  const [category, setCategory] = useState<string>(expense?.category ?? "OTHER");
  const [date, setDate] = useState(expense?.date.slice(0, 10) ?? today());
  const [receiptName, setReceiptName] = useState("");
  return <section className="form-panel expense-form"><form key={expense?.id ?? "new"} onSubmit={onSubmit}><fieldset disabled={busy} className="form-fields">
    <label>Title<input name="title" required maxLength={160} defaultValue={expense?.title} placeholder="Software subscription" /></label><label>Amount<input name="amount" required inputMode="decimal" pattern="[0-9]+([.][0-9]{1,2})?" defaultValue={expense?.amount} placeholder="0.00" /></label>
    <label>Category<Dropdown name="category" label="Category" value={category} onChange={setCategory} searchable={false} options={CATEGORIES.map((value) => ({ value, label: value.charAt(0) + value.slice(1).toLowerCase() }))} /></label><label>Expense date<DatePicker name="date" ariaLabel="Expense date" value={date} onChange={setDate} disabled={busy} /></label>
    <label>Vendor <span className="optional">optional</span><input name="vendor" maxLength={160} defaultValue={expense?.vendor ?? ""} /></label><label>Description <span className="optional">optional</span><textarea name="description" maxLength={1000} defaultValue={expense?.description ?? ""} /></label>
    <label>Notes <span className="optional">optional</span><textarea name="notes" maxLength={2000} defaultValue={expense?.notes ?? ""} /></label><div className="expense-receipt-field"><span className="expense-field-label">Receipt <span className="optional">optional</span></span><label className="expense-upload"><input name="receipt" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={(event) => setReceiptName(event.target.files?.[0]?.name ?? "")} /><span className="expense-upload-icon" aria-hidden="true">↥</span><span><strong>{receiptName || "Upload a receipt"}</strong><small>{receiptName ? "Ready to upload" : "JPEG, PNG, WebP or PDF · Up to 5 MB"}</small></span><span className="button secondary compact">Choose file</span></label>{expense?.receiptName && <span className="field-hint">Current receipt: {expense.receiptName}</span>}</div>
    <div className="invoice-actions expense-form-actions"><button className="button secondary" type="button" onClick={onCancel}>Cancel</button><button className="button primary" type="submit">{busy ? "Saving…" : expense ? "Save changes" : "Create expense"}</button>{onRemoveReceipt && <button className="text-button danger-text" type="button" onClick={onRemoveReceipt}>Remove receipt</button>}</div>
  </fieldset></form></section>;
}
