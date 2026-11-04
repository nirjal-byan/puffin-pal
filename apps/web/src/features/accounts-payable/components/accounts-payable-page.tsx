"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { Pagination } from "@/components/ui/pagination";
import { usePagedRecords } from "../hooks/use-paged-records";
import { EMPTY_PAYABLES_SUMMARY } from "../constants";
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
  const searchParams = useSearchParams();
  const [view, setView] = useState(initialView);

  const [summary, setSummary] = useState(EMPTY_PAYABLES_SUMMARY);

  const [error, setError] = useState("");
  const [modal, setModal] = useState<PayablesModal>(null);
  const [activityBillId, setActivityBillId] = useState<string | null>(searchParams.get("bill"));
  const [transitioning, setTransitioning] = useState<{
    bill: VendorBill;
    transition: BillTransition;
  } | null>(null);
  const [selected, setSelected] = useState<VendorBill | null>(null);

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
  const vendorRecords = usePagedRecords<Vendor>(
    api,
    "/vendors",
    { sort: "name", order: "asc" },
    canReadVendors && view === "vendors",
  );
  const billRecords = usePagedRecords<VendorBill>(
    api,
    "/accounts-payable/bills",
    { sort: "dueDate", order: "asc" },
    canReadBills && view === "bills",
  );
  const records = view === "vendors" ? vendorRecords : billRecords;
  const loading = records.loading;
  const summaryRequest = useRef<AbortController | null>(null);
  const loadSummary = useCallback(async () => {
    if (!canReadBills || view !== "bills") return;
    summaryRequest.current?.abort();
    const controller = new AbortController();
    summaryRequest.current = controller;
    try {
      const next = await api<PayablesSummaryValue>("/accounts-payable/summary?compact=true", {
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setSummary(next);
      setError("");
    } catch (failure) {
      if (controller.signal.aborted) return;
      setError(failure instanceof Error ? failure.message : "Could not load summary");
    }
  }, [api, canReadBills, view]);
  const load = async () => {
    await Promise.all([records.reload(), loadSummary()]);
  };
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void loadSummary();
    });
    return () => {
      active = false;
      summaryRequest.current?.abort();
    };
  }, [loadSummary]);
  const vendorNames = new Map(
    billRecords.page.items.map((bill) => [bill.vendorId, bill.vendorName || "Vendor"]),
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
      const detail = await api<Vendor>(`/vendors/${vendor.id}?includeHistory=false`);
      setEditingVendor(detail);
      setVendorForm(vendorValues(detail));
      setModal("vendor");
    });
  }
  function openBill(bill: VendorBill, attachment = false) {
    if (!attachment && !canManage) return;
    void action.run(async () => {
      const detail = await api<VendorBillDetail>(
        `/accounts-payable/bills/${bill.id}?includeHistory=false`,
      );
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
        api={api}
        canReadVendors={canReadVendors}
        filters={records.filters}
        onChange={records.setFilters}
      />
      {records.error && (
        <p role="alert">
          {records.error} <button onClick={() => void records.reload()}>Retry</button>
        </p>
      )}
      {view === "bills" && (
        <>
          <PayablesSummary summary={summary} />
          <BillsTable
            filtered={Object.entries(billRecords.filters).some(
              ([key, value]) => !["sort", "order"].includes(key) && !!value,
            )}
            bills={billRecords.page.items}
            total={billRecords.page.total}
            loading={loading}
            vendorNames={vendorNames}
            canManage={canManage}
            canApprove={permissions.includes("accounts-payable:approve")}
            canPay={canPay}
            busy={action.busy}
            onEdit={(bill) => openBill(bill)}
            onAttachments={(bill) => openBill(bill, true)}
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
          filtered={!!vendorRecords.filters.search || !!vendorRecords.filters.active}
          vendors={vendorRecords.page.items}
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
      <Pagination
        label={view === "vendors" ? "Vendors" : "Bills"}
        total={records.page.total}
        offset={records.offset}
        limit={records.limit}
        count={records.page.items.length}
        loading={records.loading}
        onOffset={records.setOffset}
        onLimit={records.setLimit}
      />
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
          api={api}
          vendors={editingBill ? [editingBill.vendor] : []}
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
