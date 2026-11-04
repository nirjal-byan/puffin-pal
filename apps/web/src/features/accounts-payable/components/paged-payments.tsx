import { useEffect, useRef } from "react";
import type { Permission } from "@puffinpal/permissions";
import { Pagination } from "@/components/ui/pagination";
import { usePagedRecords } from "../hooks/use-paged-records";
import { BillPaymentsTable } from "./bill-payments-table";
import type { AccountsPayableApi, PayablePayment } from "../types";
export function PagedPayments({
  api,
  path,
  permissions,
  onReverse,
  canReverse,
  caption = "Payment history",
  revision = 0,
}: {
  api: AccountsPayableApi;
  path: string;
  permissions: readonly Permission[];
  onReverse: (payment: PayablePayment) => void;
  canReverse?: (payment: PayablePayment) => boolean;
  caption?: string;
  revision?: number;
}) {
  const records = usePagedRecords<PayablePayment>(api, path, {
    paginated: "true",
    sort: "paymentDate",
    order: "desc",
  });
  const { reload } = records;
  const previous = useRef(revision);
  useEffect(() => {
    if (previous.current !== revision) {
      previous.current = revision;
      void reload();
    }
  }, [revision, reload]);
  return (
    <section aria-label={caption} aria-busy={records.loading}>
      <div className="standard-form-grid">
        <label>
          Payment method
          <select
            value={records.filters.method ?? ""}
            onChange={(event) =>
              records.setFilters({ ...records.filters, method: event.target.value })
            }
          >
            <option value="">All methods</option>
            {["BANK_TRANSFER", "CASH", "CARD", "CHEQUE", "OTHER"].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Reversal state
          <select
            value={records.filters.reversalState ?? "ALL"}
            onChange={(event) =>
              records.setFilters({ ...records.filters, reversalState: event.target.value })
            }
          >
            {["ALL", "ACTIVE", "REVERSED"].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Paid from
          <input
            type="date"
            value={records.filters.from ?? ""}
            onChange={(event) =>
              records.setFilters({ ...records.filters, from: event.target.value })
            }
          />
        </label>
        <label>
          Paid through
          <input
            type="date"
            min={records.filters.from}
            value={records.filters.to ?? ""}
            onChange={(event) => records.setFilters({ ...records.filters, to: event.target.value })}
          />
        </label>
        <label>
          Order
          <select
            value={records.filters.order}
            onChange={(event) =>
              records.setFilters({ ...records.filters, order: event.target.value })
            }
          >
            <option value="desc">Newest first</option>
            <option value="asc">Oldest first</option>
          </select>
        </label>
        <button
          type="button"
          className="button secondary"
          onClick={() =>
            records.setFilters({ paginated: "true", sort: "paymentDate", order: "desc" })
          }
        >
          Clear history filters
        </button>
      </div>
      {records.loading && <p role="status">Loading payment history…</p>}
      {records.error && (
        <p role="alert">
          {records.error}{" "}
          <button type="button" onClick={() => void records.reload()}>
            Retry history
          </button>
        </p>
      )}
      <BillPaymentsTable
        payments={records.page.items}
        permissions={permissions}
        busy={records.loading}
        onReverse={onReverse}
        canReverse={canReverse}
        caption={caption}
        emptyMessage={
          Object.entries(records.filters).some(
            ([key, value]) =>
              !["paginated", "sort", "order"].includes(key) && !!value && value !== "ALL",
          )
            ? "No payments match these filters."
            : "No payments recorded."
        }
      />
      <Pagination
        label={caption}
        total={records.page.total}
        offset={records.offset}
        limit={records.limit}
        count={records.page.items.length}
        loading={records.loading}
        onOffset={records.setOffset}
        onLimit={records.setLimit}
      />
    </section>
  );
}
