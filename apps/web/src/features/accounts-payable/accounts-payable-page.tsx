"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Permission } from "@puffinpal/permissions";
import { FormModal, FormModalIntro, FormModalSection } from "@/components/ui/form-modal";

type Api = <T>(
  path: string,
  options?: { method?: string; body?: unknown; signal?: AbortSignal },
) => Promise<T>;
type Vendor = {
  id: string;
  name: string;
  displayName: string | null;
  email: string | null;
  defaultCurrency: string;
  paymentTermsDays: number;
  active: boolean;
  version: number;
};
type Bill = {
  id: string;
  vendorId: string;
  billNumber: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  totalAmount: string;
  paidAmount: string;
  balance: string;
  status: string;
  settlementStatus: string;
  version: number;
  overdue: boolean;
};
type Summary = { outstanding: string; overdue: string; aging: Record<string, string> };
const emptySummary: Summary = {
  outstanding: "0.00",
  overdue: "0.00",
  aging: {
    current: "0.00",
    days1to30: "0.00",
    days31to60: "0.00",
    days61to90: "0.00",
    over90: "0.00",
  },
};

export default function AccountsPayablePage({
  api,
  permissions,
  initialView,
  onSaved,
}: {
  api: Api;
  permissions: readonly Permission[];
  initialView: "vendors" | "bills";
  onSaved: (message: string) => void;
}) {
  const [view, setView] = useState(initialView);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [summary, setSummary] = useState(emptySummary);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<"vendor" | "bill" | "payment" | null>(null);
  const [selected, setSelected] = useState<Bill | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [sort, setSort] = useState("DUE_ASC");
  const [page, setPage] = useState(0);
  const [vendorForm, setVendorForm] = useState({
    name: "",
    email: "",
    defaultCurrency: "USD",
    paymentTermsDays: 30,
  });
  const [billForm, setBillForm] = useState({
    vendorId: "",
    billNumber: "",
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate: "",
    currency: "USD",
    description: "",
    itemDescription: "",
    quantity: "1",
    unitPrice: "0.00",
    taxAmount: "0.00",
  });
  const [payment, setPayment] = useState({
    amount: "",
    paymentDate: new Date().toISOString().slice(0, 10),
    method: "BANK_TRANSFER",
    reference: "",
  });
  const canManage = permissions.includes("accounts-payable:manage");
  const canPay = permissions.includes("accounts-payable:pay");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [vendorResult, billResult, totals] = await Promise.all([
        api<{ items: Vendor[] }>("/vendors?limit=100&offset=0"),
        api<{ items: Bill[] }>("/accounts-payable/bills?limit=100&offset=0"),
        api<Summary>("/accounts-payable/summary"),
      ]);
      setVendors(vendorResult.items);
      setBills(billResult.items);
      setSummary(totals);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not load accounts payable");
    } finally {
      setLoading(false);
    }
  }, [api]);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);
  const vendorNames = useMemo(
    () => new Map(vendors.map((vendor) => [vendor.id, vendor.displayName || vendor.name])),
    [vendors],
  );
  const filteredBills = useMemo(() => {
    const term = search.trim().toLowerCase();
    return bills
      .filter(
        (bill) =>
          (!term ||
            bill.billNumber.toLowerCase().includes(term) ||
            vendorNames.get(bill.vendorId)?.toLowerCase().includes(term)) &&
          (status === "ALL" || bill.status === status),
      )
      .sort((left, right) => {
        if (sort === "DUE_DESC") return right.dueDate.localeCompare(left.dueDate);
        if (sort === "BALANCE_DESC") return Number(right.balance) - Number(left.balance);
        return left.dueDate.localeCompare(right.dueDate);
      });
  }, [bills, search, sort, status, vendorNames]);
  const filteredVendors = useMemo(() => {
    const term = search.trim().toLowerCase();
    return vendors.filter(
      (vendor) =>
        !term ||
        vendor.name.toLowerCase().includes(term) ||
        vendor.displayName?.toLowerCase().includes(term) ||
        vendor.email?.toLowerCase().includes(term),
    );
  }, [search, vendors]);
  const pageSize = 10;
  const visibleBills = filteredBills.slice(page * pageSize, (page + 1) * pageSize);
  async function createVendor() {
    await api("/vendors", {
      method: "POST",
      body: {
        ...vendorForm,
        displayName: "",
        phone: "",
        website: "",
        address: "",
        country: "",
        taxId: "",
        notes: "",
      },
    });
    setModal(null);
    setVendorForm({ name: "", email: "", defaultCurrency: "USD", paymentTermsDays: 30 });
    onSaved("Vendor created.");
    await load();
  }
  async function createBill() {
    await api("/accounts-payable/bills", {
      method: "POST",
      body: {
        vendorId: billForm.vendorId,
        billNumber: billForm.billNumber,
        issueDate: billForm.issueDate,
        dueDate: billForm.dueDate,
        currency: billForm.currency,
        description: billForm.description,
        items: [
          {
            description: billForm.itemDescription,
            quantity: billForm.quantity,
            unitPrice: billForm.unitPrice,
            taxAmount: billForm.taxAmount,
            discountAmount: "0.00",
          },
        ],
      },
    });
    setModal(null);
    onSaved("Vendor bill saved as a draft.");
    await load();
  }
  async function transition(bill: Bill, action: string) {
    if (!window.confirm(`${action === "submit" ? "Submit" : "Approve"} bill ${bill.billNumber}?`))
      return;
    await api(`/accounts-payable/bills/${bill.id}/${action}`, {
      method: "POST",
      body: { expectedVersion: bill.version },
    });
    onSaved(`Bill ${action === "submit" ? "submitted" : `${action}d`}.`);
    await load();
  }
  async function recordPayment() {
    if (!selected) return;
    await api("/accounts-payable/payments", {
      method: "POST",
      body: {
        targetType: "VENDOR_BILL",
        targetId: selected.id,
        ...payment,
        idempotencyKey: crypto.randomUUID(),
      },
    });
    setModal(null);
    setSelected(null);
    onSaved("Payment recorded.");
    await load();
  }
  return (
    <div className="ap-page">
      <section className="panel ap-toolbar">
        <div>
          <span className="eyebrow">ACCOUNTS PAYABLE</span>
          <h2>Purchases and vendor balances</h2>
          <p>Track suppliers, approve bills, and keep payments auditable.</p>
        </div>
        <div className="ap-actions">
          <div className="segmented">
            <button className={view === "bills" ? "active" : ""} onClick={() => setView("bills")}>
              Bills
            </button>
            <button
              className={view === "vendors" ? "active" : ""}
              onClick={() => setView("vendors")}
            >
              Vendors
            </button>
          </div>
          {canManage && (
            <button
              className="button primary"
              onClick={() => setModal(view === "vendors" ? "vendor" : "bill")}
            >
              + New {view === "vendors" ? "vendor" : "bill"}
            </button>
          )}
        </div>
      </section>
      {error && <div className="form-alert error">{error}</div>}
      <section className="panel ap-filter-bar" aria-label="Accounts payable filters">
        <label className="form-field ap-search">
          <span>Search</span>
          <input
            value={search}
            placeholder={view === "bills" ? "Bill number or vendor" : "Vendor name or email"}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
          />
        </label>
        {view === "bills" && (
          <>
            <label className="form-field">
              <span>Approval status</span>
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(0);
                }}
              >
                <option value="ALL">All statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="PENDING_APPROVAL">Pending approval</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="VOIDED">Voided</option>
              </select>
            </label>
            <label className="form-field">
              <span>Sort by</span>
              <select value={sort} onChange={(event) => setSort(event.target.value)}>
                <option value="DUE_ASC">Due date: soonest</option>
                <option value="DUE_DESC">Due date: latest</option>
                <option value="BALANCE_DESC">Balance: highest</option>
              </select>
            </label>
          </>
        )}
      </section>
      {view === "bills" && (
        <>
          <section className="ap-metrics">
            <article className="panel">
              <span>Outstanding</span>
              <strong>{summary.outstanding}</strong>
            </article>
            <article className="panel">
              <span>Overdue</span>
              <strong>{summary.overdue}</strong>
            </article>
            <article className="panel">
              <span>Due in 30 days</span>
              <strong>{summary.aging.days1to30}</strong>
            </article>
            <article className="panel">
              <span>Over 90 days</span>
              <strong>{summary.aging.over90}</strong>
            </article>
          </section>
          <section className="panel ap-table-panel">
            <header>
              <div>
                <h3>Vendor bills</h3>
                <p>Approval and settlement are shown independently.</p>
              </div>
              <span>{filteredBills.length} total</span>
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
                  {visibleBills.map((bill) => (
                    <tr key={bill.id}>
                      <td>
                        <strong>{bill.billNumber}</strong>
                        <small>
                          {bill.currency} {bill.totalAmount}
                        </small>
                      </td>
                      <td>{vendorNames.get(bill.vendorId) ?? "Vendor"}</td>
                      <td className={bill.overdue ? "danger-text" : ""}>
                        {bill.dueDate.slice(0, 10)}
                      </td>
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
                              onClick={() => void transition(bill, "submit")}
                            >
                              Submit
                            </button>
                          )}
                          {bill.status === "PENDING_APPROVAL" &&
                            permissions.includes("accounts-payable:approve") && (
                              <button
                                className="button secondary compact"
                                onClick={() => void transition(bill, "approve")}
                              >
                                Approve
                              </button>
                            )}
                          {bill.status === "APPROVED" &&
                            bill.settlementStatus !== "PAID" &&
                            canPay && (
                              <button
                                className="button primary compact"
                                onClick={() => {
                                  setSelected(bill);
                                  setPayment((value) => ({ ...value, amount: bill.balance }));
                                  setModal("payment");
                                }}
                              >
                                Pay
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!filteredBills.length && !loading && (
                    <tr>
                      <td colSpan={7} className="empty-cell">
                        No vendor bills match these filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {filteredBills.length > pageSize && (
              <footer className="ap-pagination">
                <span>
                  {page * pageSize + 1}–{Math.min((page + 1) * pageSize, filteredBills.length)} of{" "}
                  {filteredBills.length}
                </span>
                <div className="row-actions">
                  <button
                    className="button secondary compact"
                    disabled={page === 0}
                    onClick={() => setPage((value) => Math.max(0, value - 1))}
                  >
                    Previous
                  </button>
                  <button
                    className="button secondary compact"
                    disabled={(page + 1) * pageSize >= filteredBills.length}
                    onClick={() => setPage((value) => value + 1)}
                  >
                    Next
                  </button>
                </div>
              </footer>
            )}
          </section>
        </>
      )}
      {view === "vendors" && (
        <section className="ap-vendor-grid">
          {filteredVendors.map((vendor) => (
            <article className="panel ap-vendor-card" key={vendor.id}>
              <div className="ap-avatar">{vendor.name.slice(0, 2).toUpperCase()}</div>
              <div>
                <h3>{vendor.displayName || vendor.name}</h3>
                <p>{vendor.email || "No email added"}</p>
                <span>
                  {vendor.defaultCurrency} · Net {vendor.paymentTermsDays}
                </span>
              </div>
              <span className={`status-pill ${vendor.active ? "" : "neutral"}`}>
                {vendor.active ? "Active" : "Archived"}
              </span>
            </article>
          ))}
          {!filteredVendors.length && !loading && (
            <section className="panel empty-state">
              <h3>No vendors yet</h3>
              <p>Add a supplier before recording bills.</p>
            </section>
          )}
        </section>
      )}
      {modal === "vendor" && (
        <FormModal
          title="Add vendor"
          badge="Purchasing"
          wide
          onClose={() => setModal(null)}
          onSubmit={createVendor}
          submitLabel="Add vendor"
        >
          <FormModalIntro icon="◉" title="Supplier details">
            Keep purchasing contacts and payment defaults in one place.
          </FormModalIntro>
          <FormModalSection title="Vendor profile" description="Contact and payment defaults">
            <div className="standard-form-grid">
              <label className="form-field">
                <span>Vendor name</span>
                <input
                  required
                  value={vendorForm.name}
                  onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })}
                />
              </label>
              <label className="form-field">
                <span>
                  Email <small>Optional</small>
                </span>
                <input
                  type="email"
                  value={vendorForm.email}
                  onChange={(e) => setVendorForm({ ...vendorForm, email: e.target.value })}
                />
              </label>
              <label className="form-field">
                <span>Currency</span>
                <select
                  value={vendorForm.defaultCurrency}
                  onChange={(e) =>
                    setVendorForm({ ...vendorForm, defaultCurrency: e.target.value })
                  }
                >
                  <option>USD</option>
                  <option>NPR</option>
                  <option>EUR</option>
                  <option>GBP</option>
                  <option>CAD</option>
                </select>
              </label>
              <label className="form-field">
                <span>Payment terms</span>
                <select
                  value={vendorForm.paymentTermsDays}
                  onChange={(e) =>
                    setVendorForm({ ...vendorForm, paymentTermsDays: Number(e.target.value) })
                  }
                >
                  <option value={0}>Due immediately</option>
                  <option value={7}>Net 7</option>
                  <option value={15}>Net 15</option>
                  <option value={30}>Net 30</option>
                  <option value={60}>Net 60</option>
                </select>
              </label>
            </div>
          </FormModalSection>
        </FormModal>
      )}
      {modal === "bill" && (
        <FormModal
          title="New vendor bill"
          badge="Draft"
          wide
          onClose={() => setModal(null)}
          onSubmit={createBill}
          submitLabel="Save draft"
        >
          <FormModalIntro icon="▧" title="Record a payable">
            Add the bill details and the amount your organization owes.
          </FormModalIntro>
          <FormModalSection title="Bill details" description="Supplier, dates, and currency">
            <div className="standard-form-grid">
              <label className="form-field standard-form-grid-wide">
                <span>Vendor</span>
                <select
                  required
                  value={billForm.vendorId}
                  onChange={(e) => {
                    const vendor = vendors.find((v) => v.id === e.target.value);
                    setBillForm({
                      ...billForm,
                      vendorId: e.target.value,
                      currency: vendor?.defaultCurrency ?? billForm.currency,
                    });
                  }}
                >
                  <option value="">Select vendor</option>
                  {vendors
                    .filter((v) => v.active)
                    .map((v) => (
                      <option value={v.id} key={v.id}>
                        {v.displayName || v.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="form-field">
                <span>Bill number</span>
                <input
                  required
                  value={billForm.billNumber}
                  onChange={(e) => setBillForm({ ...billForm, billNumber: e.target.value })}
                />
              </label>
              <label className="form-field">
                <span>Currency</span>
                <select
                  value={billForm.currency}
                  onChange={(e) => setBillForm({ ...billForm, currency: e.target.value })}
                >
                  <option>USD</option>
                  <option>NPR</option>
                  <option>EUR</option>
                  <option>GBP</option>
                  <option>CAD</option>
                </select>
              </label>
              <label className="form-field">
                <span>Issue date</span>
                <input
                  type="date"
                  required
                  value={billForm.issueDate}
                  onChange={(e) => setBillForm({ ...billForm, issueDate: e.target.value })}
                />
              </label>
              <label className="form-field">
                <span>Due date</span>
                <input
                  type="date"
                  required
                  value={billForm.dueDate}
                  onChange={(e) => setBillForm({ ...billForm, dueDate: e.target.value })}
                />
              </label>
              <label className="form-field standard-form-grid-wide">
                <span>Line description</span>
                <input
                  required
                  value={billForm.itemDescription}
                  onChange={(e) => setBillForm({ ...billForm, itemDescription: e.target.value })}
                />
              </label>
              <label className="form-field">
                <span>Quantity</span>
                <input
                  inputMode="decimal"
                  required
                  value={billForm.quantity}
                  onChange={(e) => setBillForm({ ...billForm, quantity: e.target.value })}
                />
              </label>
              <label className="form-field">
                <span>Unit price</span>
                <input
                  inputMode="decimal"
                  required
                  value={billForm.unitPrice}
                  onChange={(e) => setBillForm({ ...billForm, unitPrice: e.target.value })}
                />
              </label>
            </div>
          </FormModalSection>
        </FormModal>
      )}
      {modal === "payment" && (
        <FormModal
          title="Record vendor payment"
          badge="Settlement"
          wide
          onClose={() => setModal(null)}
          onSubmit={recordPayment}
          submitLabel="Record payment"
        >
          <FormModalIntro icon="$" title="Settle a vendor bill">
            Record money already paid and keep the bill balance accurate.
          </FormModalIntro>
          <FormModalSection
            title="Payment details"
            description={selected ? `Bill ${selected.billNumber}` : undefined}
          >
            <div className="standard-form-grid">
              <label className="form-field">
                <span>Amount</span>
                <input
                  required
                  inputMode="decimal"
                  value={payment.amount}
                  onChange={(e) => setPayment({ ...payment, amount: e.target.value })}
                />
              </label>
              <label className="form-field">
                <span>Payment date</span>
                <input
                  required
                  type="date"
                  value={payment.paymentDate}
                  onChange={(e) => setPayment({ ...payment, paymentDate: e.target.value })}
                />
              </label>
              <label className="form-field">
                <span>Method</span>
                <select
                  value={payment.method}
                  onChange={(e) => setPayment({ ...payment, method: e.target.value })}
                >
                  <option value="BANK_TRANSFER">Bank transfer</option>
                  <option value="CARD">Card</option>
                  <option value="CASH">Cash</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="OTHER">Other</option>
                </select>
              </label>
              <label className="form-field">
                <span>
                  Reference <small>Optional</small>
                </span>
                <input
                  value={payment.reference}
                  onChange={(e) => setPayment({ ...payment, reference: e.target.value })}
                />
              </label>
            </div>
          </FormModalSection>
        </FormModal>
      )}
    </div>
  );
}
