import type { PayablesView } from "../types";
export function PayablesToolbar({
  view,
  canManage,
  onView,
  onCreate,
}: {
  view: PayablesView;
  canManage: boolean;
  onView: (view: PayablesView) => void;
  onCreate: () => void;
}) {
  return (
    <section className="panel ap-toolbar">
      <div>
        <span className="eyebrow">{view === "vendors" ? "SUPPLIERS" : "ACCOUNTS PAYABLE"}</span>
        <h2>{view === "vendors" ? "Vendor directory" : "Bills and payments"}</h2>
        <p>
          {view === "vendors"
            ? "Manage supplier contacts and their default payment terms."
            : "Review approvals, due dates, outstanding balances, and settlements."}
        </p>
      </div>
      <div className="ap-actions">
        <div className="banking-tabs" role="tablist" aria-label="Purchasing views">
          {(["bills", "vendors"] as const).map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={view === item}
              className={view === item ? "active" : ""}
              onClick={() => onView(item)}
            >
              {item[0]!.toUpperCase() + item.slice(1)}
            </button>
          ))}
        </div>
        {canManage && (
          <button className="button primary" onClick={onCreate}>
            + New {view === "vendors" ? "vendor" : "bill"}
          </button>
        )}
      </div>
    </section>
  );
}
