import type { Vendor, VendorBill } from "./types";

export function filterAndSortBills(
  bills: VendorBill[],
  vendorNames: Map<string, string>,
  search: string,
  status: string,
  sort: string,
) {
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
}

export function filterVendors(vendors: Vendor[], search: string) {
  const term = search.trim().toLowerCase();
  return vendors.filter(
    (vendor) =>
      !term ||
      vendor.name.toLowerCase().includes(term) ||
      vendor.displayName?.toLowerCase().includes(term) ||
      vendor.email?.toLowerCase().includes(term),
  );
}
