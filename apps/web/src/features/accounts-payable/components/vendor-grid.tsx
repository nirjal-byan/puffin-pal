import type { Vendor } from "../types";

export function VendorGrid({
  vendors,
  loading,
  canManage,
  onAdd,
  onEdit,
  onArchive,
  busy = false,
  filtered = false,
}: {
  vendors: Vendor[];
  loading: boolean;
  canManage: boolean;
  onAdd: () => void;
  onEdit: (vendor: Vendor) => void;
  onArchive: (vendor: Vendor) => void;
  busy?: boolean;
  filtered?: boolean;
}) {
  return (
    <section className="ap-vendor-grid">
      {vendors.map((vendor) => (
        <article className="panel ap-vendor-card" key={vendor.id}>
          <div className="ap-avatar">{vendor.name.slice(0, 2).toUpperCase()}</div>
          <div>
            <h3>{vendor.displayName || vendor.name}</h3>
            <p>{vendor.email || "No email added"}</p>
            <span>
              {vendor.defaultCurrency} · Net {vendor.paymentTermsDays}
            </span>
          </div>
          <span className={`status-pill ${vendor.active ? "" : "neutral"}`}>
            {vendor.active ? "Active" : "Archived"}
          </span>
          {canManage && (
            <div className="row-actions">
              <button
                type="button"
                className="button secondary compact"
                disabled={busy}
                onClick={() => onEdit(vendor)}
              >
                Edit
              </button>
              {vendor.active && (
                <button
                  type="button"
                  className="button secondary compact"
                  disabled={busy}
                  onClick={() => onArchive(vendor)}
                >
                  Archive
                </button>
              )}
            </div>
          )}
        </article>
      ))}
      {!vendors.length && !loading && (
        <section className="panel empty-state ap-vendor-empty">
          <span className="empty-state-icon" aria-hidden="true">
            ◉
          </span>
          <h3>{filtered ? "No vendors match these filters" : "No vendors yet"}</h3>
          <p>
            {filtered
              ? "Try clearing or changing your filters."
              : "Add your first supplier to start recording and tracking bills."}
          </p>
          {canManage && (
            <button className="button primary" type="button" onClick={onAdd}>
              + Add vendor
            </button>
          )}
        </section>
      )}
    </section>
  );
}
