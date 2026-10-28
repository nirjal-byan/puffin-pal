import type { ExpensePage } from "../types";

export function ExpensePagination({
  page,
  offset,
  loading,
  onOffsetChange,
}: {
  page: ExpensePage;
  offset: number;
  loading: boolean;
  onOffsetChange: (offset: number) => void;
}) {
  return (
    <div className="pagination">
      <span>
        {page.total
          ? `Showing ${page.offset + 1}–${Math.min(page.offset + page.items.length, page.total)} of ${page.total}`
          : "No records"}
      </span>
      <div>
        <button
          className="button secondary compact"
          disabled={offset === 0 || loading}
          onClick={() => onOffsetChange(Math.max(0, offset - 20))}
        >
          ← Previous
        </button>
        <button
          className="button secondary compact"
          disabled={offset + page.items.length >= page.total || loading}
          onClick={() => onOffsetChange(offset + 20)}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
