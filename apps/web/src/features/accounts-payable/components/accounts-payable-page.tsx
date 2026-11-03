"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Permission } from "@puffinpal/permissions";
import { BillActivityDialog } from "../dialogs/bill-activity-dialog";
import { BillTransitionDialog } from "../dialogs/bill-transition-dialog";
import type { BillTransition } from "../types";
import { ArchiveVendorDialog } from "../dialogs/archive-vendor-dialog";
import { usePayableAction } from "../hooks/use-payable-action";
import {
  billValues,
  emptyBill,
  emptyVendor,
  saveBill,
  saveVendor,
  vendorValues,
} from "../services/payables-api";
import { BillAttachmentsDialog } from "../dialogs/bill-attachments-dialog";
import { EMPTY_PAYABLES_SUMMARY, PAYABLE_PAGE_SIZE } from "../constants";
import type {
  AccountsPayableApi,
  BillFormValue,
  PayablesModal,
  PayablesSummary as PayablesSummaryValue,
  PayablesView,
  Vendor,
  VendorBill,
  VendorBillDetail,
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
  const [activityBillId, setActivityBillId] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState<{
    bill: VendorBill;
    transition: BillTransition;
  } | null>(null);
  const [selected, setSelected] = useState<VendorBill | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [sort, setSort] = useState("DUE_ASC");
  const [page, setPage] = useState(0);
  const action = usePayableAction();
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [archiveVendor, setArchiveVendor] = useState<Vendor | null>(null);
  const [editingBill, setEditingBill] = useState<VendorBillDetail | null>(null);
  const [attachmentBill, setAttachmentBill] = useState<VendorBillDetail | null>(null);
  const [vendorForm, setVendorForm] = useState<VendorFormValue>(emptyVendor);
  const [billForm, setBillForm] = useState<BillFormValue>(emptyBill);
  const [payment, setPayment] = useState<VendorPaymentFormValue>({
    amount: "",
    paymentDate: new Date().toISOString().slice(0, 10),
    method: "BANK_TRANSFER",
    reference: "",
  });
  const canManageVendors = permissions.includes("vendors:manage");
  const canReadVendors = permissions.includes("vendors:read");
  const canReadBills = permissions.includes("accounts-payable:read");
  const canManage = permissions.includes("accounts-payable:manage");
  const canPay = permissions.includes("accounts-payable:pay");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [vendorResult, billResult, totals] = await Promise.all([
        canReadVendors
          ? api<{ items: Vendor[] }>("/vendors?limit=100&offset=0")
          : Promise.resolve({ items: [] as Vendor[] }),
        canReadBills
          ? api<{ items: VendorBill[] }>("/accounts-payable/bills?limit=100&offset=0")
          : Promise.resolve({ items: [] as VendorBill[] }),
        canReadBills
          ? api<PayablesSummaryValue>("/accounts-payable/summary")
          : Promise.resolve(EMPTY_PAYABLES_SUMMARY),
      ]);
      setVendors(vendorResult.items);
      setBills(billResult.items);
      setSummary(totals);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not load accounts payable");
    } finally {
      setLoading(false);
    }
  }, [api, canReadVendors, canReadBills]);
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
  function closeModal() {
    if (!action.busy) setModal(null);
  }
  function openCreate() {
    action.clearError();
    if (view === "vendors") {
      setEditingVendor(null);
      setVendorForm(emptyVendor());
      setModal("vendor");
    } else {
      setEditingBill(null);
      setBillForm(emptyBill());
      setModal("bill");
    }
  }
  async function createVendor() {
    if (!canManageVendors) return;
    await action.run(async () => {
      await saveVendor(api, vendorForm, editingVendor);
      setModal(null);
      onSaved(editingVendor ? "Vendor updated." : "Vendor created.");
      await load();
    });
  }
  async function createBill() {
    if (!canManage) return;
    await action.run(async () => {
      await saveBill(api, billForm, editingBill);
      setModal(null);
      onSaved(editingBill ? "Vendor bill updated." : "Vendor bill saved as a draft.");
      await load();
    });
  }
  function editVendor(vendor: Vendor) {
    if (!canManageVendors) return;
    void action.run(async () => {
      const detail = await api<Vendor>(`/vendors/${vendor.id}`);
      setEditingVendor(detail);
      setVendorForm(vendorValues(detail));
      setModal("vendor");
    });
  }
  function openBill(bill: VendorBill, attachment = false) {
    if (!attachment && !canManage) return;
    void action.run(async () => {
      const detail = await api<VendorBillDetail>(`/accounts-payable/bills/${bill.id}`);
      if (attachment) {
        setAttachmentBill(detail);
        return;
      }
      if (detail.status !== "DRAFT")
        throw new Error(
          "Only draft bills can be edited. Reload the list to see its latest status.",
        );
      setEditingBill(detail);
      setBillForm(billValues(detail));
      setModal("bill");
    });
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
        busy={action.busy}
        view={view}
        canManage={view === "vendors" ? canManageVendors : canManage && canReadVendors}
        canViewVendors={canReadVendors}
        canViewBills={canReadBills}
        onView={setView}
        onCreate={openCreate}
      />
      {(error || (!modal && !archiveVendor && action.error)) && (
        <div className="form-alert error" role="alert">
          {error || action.error}
        </div>
      )}
      {action.busy && !modal && <p role="status">Loading…</p>}
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
            busy={action.busy}
            onEdit={(bill) => openBill(bill)}
            onAttachments={(bill) => openBill(bill, true)}
            onPage={setPage}
            onTransition={(bill, transition) => setTransitioning({ bill, transition })}
            onDetails={(bill) => setActivityBillId(bill.id)}
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
          canManage={canManageVendors}
          busy={action.busy}
          onEdit={editVendor}
          onArchive={(vendor) => {
            action.clearError();
            setArchiveVendor(vendor);
          }}
          onAdd={openCreate}
        />
      )}
      {modal === "vendor" && (
        <VendorDialog
          editing={!!editingVendor}
          busy={action.busy}
          error={action.error}
          value={vendorForm}
          onChange={setVendorForm}
          onClose={closeModal}
          onSubmit={createVendor}
        />
      )}
      {modal === "bill" && (
        <BillDialog
          editing={!!editingBill}
          busy={action.busy}
          error={action.error}
          value={billForm}
          vendors={
            editingBill && !vendors.some(({ id }) => id === editingBill.vendorId)
              ? [...vendors, editingBill.vendor]
              : vendors
          }
          onChange={setBillForm}
          onClose={closeModal}
          onSubmit={createBill}
        />
      )}
      {modal === "payment" && (
        <VendorPaymentDialog
          bill={selected}
          value={payment}
          onChange={setPayment}
          onClose={closeModal}
          onSubmit={recordPayment}
        />
      )}
      {transitioning && (
        <BillTransitionDialog
          bill={transitioning.bill}
          transition={transitioning.transition}
          api={api}
          permissions={permissions}
          onClose={() => setTransitioning(null)}
          onSaved={async () => {
            onSaved("Bill status updated.");
            await load();
          }}
        />
      )}
      {activityBillId && (
        <BillActivityDialog
          id={activityBillId}
          api={api}
          permissions={permissions}
          onClose={() => setActivityBillId(null)}
          onSaved={async (message) => {
            onSaved(message);
            await load();
          }}
          onEdit={(bill) => {
            setActivityBillId(null);
            openBill(bill);
          }}
          onAttachments={(bill) => {
            setActivityBillId(null);
            openBill(bill, true);
          }}
        />
      )}
      {archiveVendor && canManageVendors && (
        <ArchiveVendorDialog
          vendor={archiveVendor}
          api={api}
          onClose={() => setArchiveVendor(null)}
          onSaved={async () => {
            onSaved("Vendor archived.");
            await load();
          }}
        />
      )}
      {attachmentBill && (
        <BillAttachmentsDialog
          api={api}
          initialBill={attachmentBill}
          canManage={canManage}
          onClose={() => setAttachmentBill(null)}
          onSaved={async (message) => {
            onSaved(message);
            await load();
          }}
        />
      )}
    </div>
  );
}
