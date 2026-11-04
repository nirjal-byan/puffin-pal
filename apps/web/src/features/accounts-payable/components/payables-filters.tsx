import { useState } from "react";
import { DebouncedSearch } from "@/components/ui/debounced-search";
import type { AccountsPayableApi, PayablesView } from "../types";
import type { PageFilters } from "../hooks/use-paged-records";
import { VendorPicker } from "./vendor-picker";
const SORT_LABELS: Record<string, string> = {
  name: "Vendor name",
  createdAt: "Created date",
  dueDate: "Due date",
  issueDate: "Issue date",
  totalAmount: "Bill amount",
  balance: "Outstanding balance",
};
export function PayablesFilters({
  view,
  filters,
  onChange,
  api,
  canReadVendors,
}: {
  view: PayablesView;
  filters: PageFilters;
  onChange: (value: PageFilters) => void;
  api: AccountsPayableApi;
  canReadVendors: boolean;
}) {
  const [searchEpoch, setSearchEpoch] = useState(0);
  const field = (key: string, value: string) => onChange({ ...filters, [key]: value });
  return (
    <section className="panel" aria-label="Accounts payable filters">
      <div className="standard-form-grid">
        <label className="form-field">
          Search
          <DebouncedSearch
            key={`${view}:${searchEpoch}`}
            label={view === "vendors" ? "Search vendors" : "Search bills"}
            value={filters.search ?? ""}
            placeholder={
              view === "vendors"
                ? "Vendor name, email or phone"
                : "Bill number, reference, vendor or description"
            }
            onChange={(value) => field("search", value)}
          />
        </label>
        {view === "vendors" ? (
          <label className="form-field">
            Vendor status
            <select
              value={filters.active ?? ""}
              onChange={(event) => field("active", event.target.value)}
            >
              <option value="">All vendors</option>
              <option value="true">Active</option>
              <option value="false">Archived</option>
            </select>
          </label>
        ) : (
          <>
            <label className="form-field">
              Approval status
              <select
                value={filters.status ?? ""}
                onChange={(event) => field("status", event.target.value)}
              >
                <option value="">All statuses</option>
                {["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED", "VOIDED"].map((value) => (
                  <option key={value} value={value}>
                    {SORT_LABELS[value] ?? value.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              Settlement status
              <select
                value={filters.settlementStatus ?? ""}
                onChange={(event) => field("settlementStatus", event.target.value)}
              >
                <option value="">All payments</option>
                {["UNPAID", "PARTIALLY_PAID", "PAID"].map((value) => (
                  <option key={value} value={value}>
                    {SORT_LABELS[value] ?? value.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              Due from
              <input
                type="date"
                value={filters.from ?? ""}
                onChange={(event) => field("from", event.target.value)}
              />
            </label>
            <label className="form-field">
              Due through
              <input
                type="date"
                min={filters.from}
                value={filters.to ?? ""}
                onChange={(event) => field("to", event.target.value)}
              />
            </label>
            {canReadVendors && (
              <VendorPicker
                api={api}
                includeArchived
                value={filters.vendorId ?? ""}
                onChange={(value) => field("vendorId", value)}
              />
            )}
          </>
        )}
        <label className="form-field">
          Sort by
          <select
            value={filters.sort ?? (view === "vendors" ? "name" : "dueDate")}
            onChange={(event) => field("sort", event.target.value)}
          >
            {(view === "vendors"
              ? ["name", "createdAt"]
              : ["dueDate", "issueDate", "totalAmount", "balance"]
            ).map((value) => (
              <option key={value} value={value}>
                {SORT_LABELS[value] ?? value.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          Order
          <select
            value={filters.order ?? "asc"}
            onChange={(event) => field("order", event.target.value)}
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </label>
        <button
          type="button"
          className="button secondary"
          onClick={() => {
            setSearchEpoch((value) => value + 1);
            onChange({ sort: view === "vendors" ? "name" : "dueDate", order: "asc" });
          }}
        >
          Clear filters
        </button>
      </div>
    </section>
  );
}
