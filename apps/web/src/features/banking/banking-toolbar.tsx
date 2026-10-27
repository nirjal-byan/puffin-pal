import type { BankingView } from "./types";

export function BankingToolbar({
  view,
  canManage,
  loading,
  onViewChange,
  onAddAccount,
  onImport,
  onCreateBatch,
  onRefresh,
}: {
  view: BankingView;
  canManage: boolean;
  loading: boolean;
  onViewChange: (view: BankingView) => void;
  onAddAccount: () => void;
  onImport: () => void;
  onCreateBatch: () => void;
  onRefresh: () => void;
}) {
  return (
    <section className="panel banking-toolbar">
      <div className="banking-tabs" role="tablist" aria-label="Banking views">
        {(["transactions", "accounts", "imports", "batches"] as const).map((item) => (
          <button
            key={item}
            className={view === item ? "active" : ""}
            type="button"
            onClick={() => onViewChange(item)}
          >
            {item === "batches" ? "Payment batches" : item[0]!.toUpperCase() + item.slice(1)}
          </button>
        ))}
      </div>
      <div className="banking-actions">
        {canManage && view === "accounts" && (
          <button className="button primary" onClick={onAddAccount}>
            + Add account
          </button>
        )}
        {canManage && (view === "transactions" || view === "imports") && (
          <button className="button primary" onClick={onImport}>
            Import statement
          </button>
        )}
        {canManage && view === "batches" && (
          <button className="button primary" onClick={onCreateBatch}>
            + Payment batch
          </button>
        )}
        <button className="button secondary" onClick={onRefresh} disabled={loading}>
          ↻ Refresh
        </button>
      </div>
    </section>
  );
}
