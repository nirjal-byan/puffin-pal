import type { Permission } from "@puffinpal/permissions";
import type {
  AccountsPayableApi,
  BillTransition,
  PayablePayment,
  VendorBill,
  VendorBillDetail,
} from "../types";

export const TRANSITION_LABELS: Record<BillTransition, string> = {
  submit: "Submit",
  approve: "Approve",
  reject: "Reject",
  resubmit: "Resubmit",
  void: "Void",
};
export function billTransitions(
  bill: Pick<VendorBill, "status" | "settlementStatus">,
  permissions: readonly Permission[],
): BillTransition[] {
  const manage = permissions.includes("accounts-payable:manage");
  const approve = permissions.includes("accounts-payable:approve");
  switch (bill.status) {
    case "DRAFT":
      return manage ? ["submit"] : [];
    case "PENDING_APPROVAL":
      return approve ? ["approve", "reject"] : [];
    case "REJECTED":
      return manage ? ["resubmit"] : [];
    case "APPROVED":
      return approve && bill.settlementStatus === "UNPAID" ? ["void"] : [];
    default:
      return [];
  }
}
export function reasonError(reason: string) {
  return !reason.trim() || reason.trim().length > 500 ? "Enter a reason of 1–500 characters." : "";
}
export function transitionBill(
  api: AccountsPayableApi,
  bill: VendorBill,
  transition: BillTransition,
  permissions: readonly Permission[],
  reason = "",
) {
  if (!billTransitions(bill, permissions).includes(transition))
    throw new Error("This action is not available for this bill or your permissions.");
  if (transition === "reject" && reasonError(reason)) throw new Error(reasonError(reason));
  return api(`/accounts-payable/bills/${bill.id}/${transition}`, {
    method: "POST",
    body: {
      expectedVersion: bill.version,
      ...(transition === "reject" ? { reason: reason.trim() } : {}),
    },
  });
}
export function canReversePayment(payment: PayablePayment, permissions: readonly Permission[]) {
  return permissions.includes("accounts-payable:pay") && !payment.reversedAt;
}
export function reverseBillPayment(
  api: AccountsPayableApi,
  billId: string,
  payment: PayablePayment,
  permissions: readonly Permission[],
  reason: string,
) {
  if (payment.vendorBillId !== billId || payment.targetType !== "VENDOR_BILL")
    throw new Error("Payment does not belong to this bill.");
  if (!canReversePayment(payment, permissions))
    throw new Error("Payment is already reversed or you do not have permission to reverse it.");
  if (reasonError(reason)) throw new Error(reasonError(reason));
  return api(`/accounts-payable/payments/${payment.id}/reverse`, {
    method: "POST",
    body: { expectedVersion: payment.version, reason: reason.trim() },
  });
}
export async function loadBillActivity(api: AccountsPayableApi, id: string, signal?: AbortSignal) {
  const bill = await api<VendorBillDetail>(`/accounts-payable/bills/${id}?includeHistory=false`, {
    signal,
  });
  return { bill, payments: [] as PayablePayment[] };
}
