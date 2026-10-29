import type { Vendor } from "../types";

export function VendorGrid({
  vendors,
  loading,
  canManage,
  onAdd,
}: {
  vendors: Vendor[];
  loading: boolean;
  canManage: boolean;
  onAdd: () => void;
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
        </article>
      ))}
      {!vendors.length && !loading && (
        <section className="panel empty-state ap-vendor-empty">
          <span className="empty-state-icon" aria-hidden="true">
            ◉
          </span>
          <h3>No vendors yet</h3>
          <p>Add your first supplier to start recording and tracking bills.</p>
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
