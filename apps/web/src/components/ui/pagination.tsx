export function Pagination({
  total,
  offset,
  limit,
  count,
  loading,
  onOffset,
  onLimit,
  label = "Records",
}: {
  total: number;
  offset: number;
  limit: number;
  count: number;
  loading: boolean;
  onOffset: (value: number) => void;
  onLimit: (value: number) => void;
  label?: string;
}) {
  return (
    <nav className="pagination" aria-label={`${label} pagination`}>
      <span aria-live="polite">
        {total
          ? `${offset + 1}–${Math.min(offset + count, total)} of ${total} · Page ${Math.floor(offset / limit) + 1} of ${Math.max(1, Math.ceil(total / limit))}`
          : "No matching records"}
      </span>
      <label>
        Rows per page{" "}
        <select
          aria-label={`${label} page size`}
          value={limit}
          disabled={loading}
          onChange={(event) => onLimit(Number(event.target.value))}
        >
          {[10, 20, 50, 100].map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>
      <div>
        <button
          type="button"
          className="button secondary compact"
          disabled={loading || offset === 0}
          onClick={() => onOffset(Math.max(0, offset - limit))}
        >
          Previous
        </button>
        <button
          type="button"
          className="button secondary compact"
          disabled={loading || offset + limit >= total}
          onClick={() => onOffset(offset + limit)}
        >
          Next
        </button>
      </div>
    </nav>
  );
}
