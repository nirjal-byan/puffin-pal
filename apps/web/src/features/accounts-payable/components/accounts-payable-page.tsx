"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Permission } from "@puffinpal/permissions";
import { EMPTY_PAYABLES_SUMMARY, PAYABLE_PAGE_SIZE } from "../constants";
import type {
  AccountsPayableApi,
  BillFormValue,
  PayablesModal,
  PayablesSummary as PayablesSummaryValue,
  PayablesView,
  Vendor,
  VendorBill,
  VendorFormValue,
  VendorPaymentFormValue,
} from "../types";
import { filterAndSortBills, filterVendors } from "../utils";
import { VendorGrid } from "./vendor-grid";
import { BillDialog } from "../dialogs/bill-dialog";
import { BillsTable } from "./bills-table";
import { PayablesFilters } from "./payables-filters";
import { PayablesSummary } from "./payables-summary";
import { PayablesToolbar } from "./payables-toolbar";
import { VendorDialog } from "../dialogs/vendor-dialog";
import { VendorPaymentDialog } from "../dialogs/vendor-payment-dialog";

export default function AccountsPayablePage({
  api,
  permissions,
  initialView,
  onSaved,
}: {
  api: AccountsPayableApi;
  permissions: readonly Permission[];
  initialView: PayablesView;
  onSaved: (message: string) => void;
}) {
  const [view, setView] = useState(initialView);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [bills, setBills] = useState<VendorBill[]>([]);
  const [summary, setSummary] = useState(EMPTY_PAYABLES_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<PayablesModal>(null);
  const [selected, setSelected] = useState<VendorBill | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [sort, setSort] = useState("DUE_ASC");
  const [page, setPage] = useState(0);
  const [vendorForm, setVendorForm] = useState<VendorFormValue>({
    name: "",
    email: "",
    defaultCurrency: "USD",
    paymentTermsDays: 30,
  });
  const [billForm, setBillForm] = useState<BillFormValue>({
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
  const [payment, setPayment] = useState<VendorPaymentFormValue>({
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
        api<{ items: VendorBill[] }>("/accounts-payable/bills?limit=100&offset=0"),
        api<PayablesSummaryValue>("/accounts-payable/summary"),
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
  const filteredBills = useMemo(
    () => filterAndSortBills(bills, vendorNames, search, status, sort),
    [bills, search, sort, status, vendorNames],
  );
  const filteredVendors = useMemo(() => filterVendors(vendors, search), [search, vendors]);
  const visibleBills = filteredBills.slice(
    page * PAYABLE_PAGE_SIZE,
    (page + 1) * PAYABLE_PAGE_SIZE,
  );
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
  async function transition(bill: VendorBill, action: string) {
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
    <div className="ap-page" data-view={view}>
      <PayablesToolbar
        view={view}
        canManage={canManage}
        onView={setView}
        onCreate={() => setModal(view === "vendors" ? "vendor" : "bill")}
      />
      {error && <div className="form-alert error">{error}</div>}
      <PayablesFilters
        view={view}
        search={search}
        status={status}
        sort={sort}
        onSearch={(value) => {
          setSearch(value);
          setPage(0);
        }}
        onStatus={(value) => {
          setStatus(value);
          setPage(0);
        }}
        onSort={setSort}
      />
      {view === "bills" && (
        <>
          <PayablesSummary summary={summary} />
          <BillsTable
            bills={visibleBills}
            total={filteredBills.length}
            page={page}
            loading={loading}
            vendorNames={vendorNames}
            canManage={canManage}
            canApprove={permissions.includes("accounts-payable:approve")}
            canPay={canPay}
            onPage={setPage}
            onTransition={(bill, action) => void transition(bill, action)}
            onPay={(bill) => {
              setSelected(bill);
              setPayment((value) => ({ ...value, amount: bill.balance }));
              setModal("payment");
            }}
          />
        </>
      )}
      {view === "vendors" && (
        <VendorGrid
          vendors={filteredVendors}
          loading={loading}
          canManage={canManage}
          onAdd={() => setModal("vendor")}
        />
      )}
      {modal === "vendor" && (
        <VendorDialog
          value={vendorForm}
          onChange={setVendorForm}
          onClose={() => setModal(null)}
          onSubmit={createVendor}
        />
      )}
      {modal === "bill" && (
        <BillDialog
          value={billForm}
          vendors={vendors}
          onChange={setBillForm}
          onClose={() => setModal(null)}
          onSubmit={createBill}
        />
      )}
      {modal === "payment" && (
        <VendorPaymentDialog
          bill={selected}
          value={payment}
          onChange={setPayment}
          onClose={() => setModal(null)}
          onSubmit={recordPayment}
        />
      )}
    </div>
  );
}
