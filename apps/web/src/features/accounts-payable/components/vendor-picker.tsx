import { useState } from "react";
import { DebouncedSearch } from "@/components/ui/debounced-search";
import { usePagedRecords } from "../hooks/use-paged-records";
import { Pagination } from "@/components/ui/pagination";
import type { AccountsPayableApi, Vendor } from "../types";
export function VendorPicker({
  api,
  value,
  onChange,
  selectedName,
  includeArchived = false,
}: {
  api: AccountsPayableApi;
  value: string;
  onChange: (id: string, vendor?: Vendor) => void;
  selectedName?: string;
  includeArchived?: boolean;
}) {
  const [chosenLabel, setChosenLabel] = useState(selectedName ?? "");
  const records = usePagedRecords<Vendor>(api, "/vendors", {
    active: includeArchived ? "" : "true",
    sort: "name",
    order: "asc",
  });
  return (
    <div className="form-field" aria-label="Vendor selection">
      <label>
        Search vendors
        <DebouncedSearch
          label="Search vendor choices"
          value={records.filters.search ?? ""}
          onChange={(search) => records.setFilters({ ...records.filters, search })}
        />
      </label>
      {value && (
        <p>
          Selected: {selectedName || chosenLabel || "Vendor selected"}{" "}
          <button type="button" className="text-button" onClick={() => onChange("")}>
            Clear vendor
          </button>
        </p>
      )}
      {records.loading && <p role="status">Loading vendors…</p>}
      {records.error && (
        <p role="alert">
          {records.error}{" "}
          <button type="button" onClick={() => void records.reload()}>
            Retry
          </button>
        </p>
      )}
      <select
        aria-label="Choose vendor"
        value={value}
        onChange={(event) => {
          const vendor = records.page.items.find((item) => item.id === event.target.value);
          setChosenLabel(vendor?.displayName || vendor?.name || selectedName || "");
          onChange(event.target.value, vendor);
        }}
      >
        <option value="">Choose a vendor</option>
        {value && !records.page.items.some((vendor) => vendor.id === value) && (
          <option value={value}>{selectedName || chosenLabel || "Current vendor"}</option>
        )}
        {records.page.items.map((vendor) => (
          <option key={vendor.id} value={vendor.id}>
            {vendor.displayName || vendor.name}
            {vendor.active ? "" : " (archived)"}
          </option>
        ))}
      </select>
      <Pagination
        label="Vendor choices"
        {...{
          total: records.page.total,
          offset: records.offset,
          limit: records.limit,
          count: records.page.items.length,
          loading: records.loading,
        }}
        onOffset={records.setOffset}
        onLimit={records.setLimit}
      />
    </div>
  );
}
