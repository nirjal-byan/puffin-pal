import { Pagination } from "@/components/ui/pagination";
import type { ExpensePage } from "../types";
export function ExpensePagination({
  page,
  offset,
  loading,
  onOffsetChange,
  onLimitChange,
}: {
  page: ExpensePage;
  offset: number;
  loading: boolean;
  onOffsetChange: (value: number) => void;
  onLimitChange: (value: number) => void;
}) {
  return (
    <Pagination
      label="Expenses"
      total={page.total}
      offset={offset}
      limit={page.limit}
      count={page.items.length}
      loading={loading}
      onOffset={onOffsetChange}
      onLimit={onLimitChange}
    />
  );
}
