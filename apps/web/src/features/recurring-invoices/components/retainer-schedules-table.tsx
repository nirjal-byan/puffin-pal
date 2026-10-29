import type { Permission } from "@puffinpal/permissions";
import type { RecurringSchedule } from "../types";

export function RetainerSchedulesTable({
  rows,
  currency,
  permissions,
  onEdit,
  onTransition,
}: {
  rows: RecurringSchedule[];
  currency: string;
  permissions: readonly Permission[];
  onEdit: (row: RecurringSchedule) => void;
  onTransition: (row: RecurringSchedule, action: "pause" | "resume" | "cancel") => void;
}) {
  const canUpdate = permissions.includes("retainers:update");
  const canDelete = permissions.includes("retainers:delete");
  return (
    <section className="panel" data-tour="retainer-list">
      <div className="panel-heading">
        <h3>Schedules</h3>
        <span className="muted">{rows.length} total</span>
      </div>
      {!rows.length ? (
        <div className="empty-state">
          <span className="empty-symbol">↻</span>
          <h3>No recurring schedules</h3>
          <p>Create a schedule for repeat billing.</p>
        </div>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Client</th>
                <th>Amount</th>
                <th>Frequency</th>
                <th>Next invoice</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.name}</strong>
                    <small className="muted recurring-subtitle">
                      {row.autoIssue ? "Issues automatically" : "Creates a draft"}
                    </small>
                  </td>
                  <td>{row.clientName}</td>
                  <td>
                    {new Intl.NumberFormat("en", {
                      style: "currency",
                      currency: row.currency ?? currency,
                    }).format(Number(row.amount ?? 0))}
                  </td>
                  <td>
                    Every {row.interval > 1 ? `${row.interval} ` : ""}
                    {row.frequency.toLowerCase()}
                  </td>
                  <td>
                    {new Date(row.nextRunAt).toLocaleDateString()}
                    <small className="muted recurring-subtitle">
                      Last:{" "}
                      {row.lastRunAt
                        ? new Date(row.lastRunAt).toLocaleDateString()
                        : "Not generated"}
                    </small>
                  </td>
                  <td>
                    <span className={`status-badge status-${row.status.toLowerCase()}`}>
                      {row.status}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      {canUpdate && (
                        <button className="text-button" onClick={() => onEdit(row)}>
                          Edit
                        </button>
                      )}
                      {canUpdate && row.status === "ACTIVE" && (
                        <button className="text-button" onClick={() => onTransition(row, "pause")}>
                          Pause
                        </button>
                      )}
                      {canUpdate && row.status === "PAUSED" && (
                        <button className="text-button" onClick={() => onTransition(row, "resume")}>
                          Resume
                        </button>
                      )}
                      {canDelete && !["CANCELLED", "COMPLETED"].includes(row.status) && (
                        <button
                          className="text-button danger-text"
                          onClick={() => onTransition(row, "cancel")}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
