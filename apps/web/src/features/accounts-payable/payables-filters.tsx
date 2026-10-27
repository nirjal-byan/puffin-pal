import { Dropdown } from "@/components/ui/dropdown";
import { FormField } from "@/components/ui/form-modal";
import type { PayablesView } from "./types";
export function PayablesFilters({
  view,
  search,
  status,
  sort,
  onSearch,
  onStatus,
  onSort,
}: {
  view: PayablesView;
  search: string;
  status: string;
  sort: string;
  onSearch: (value: string) => void;
  onStatus: (value: string) => void;
  onSort: (value: string) => void;
}) {
  return (
    <section
      className={`panel ap-filter-bar${view === "vendors" ? " vendors-only" : ""}`}
      aria-label="Accounts payable filters"
    >
      <label className="form-field ap-search">
        <span>Search</span>
        <input
          value={search}
          placeholder={view === "bills" ? "Bill number or vendor" : "Vendor name or email"}
          onChange={(event) => onSearch(event.target.value)}
        />
      </label>
      {view === "bills" && (
        <>
          <FormField label="Approval status">
            <Dropdown
              name="payable-status"
              label="Approval status"
              searchable={false}
              value={status}
              onChange={onStatus}
              options={[
                { value: "ALL", label: "All statuses" },
                { value: "DRAFT", label: "Draft" },
                { value: "PENDING_APPROVAL", label: "Pending approval" },
                { value: "APPROVED", label: "Approved" },
                { value: "REJECTED", label: "Rejected" },
                { value: "VOIDED", label: "Voided" },
              ]}
            />
          </FormField>
          <FormField label="Sort by">
            <Dropdown
              name="payable-sort"
              label="Sort bills"
              searchable={false}
              value={sort}
              onChange={onSort}
              options={[
                { value: "DUE_ASC", label: "Due date: soonest" },
                { value: "DUE_DESC", label: "Due date: latest" },
                { value: "BALANCE_DESC", label: "Balance: highest" },
              ]}
            />
          </FormField>
        </>
      )}
    </section>
  );
}
