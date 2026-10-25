import type { Permission } from "@puffinpal/permissions";
import type { Session } from "@/lib/api";
import AccessLayout from "./access-layout";
export default function AccessPage({
  session,
  refreshAccess,
  refreshing,
}: {
  session: Session;
  refreshAccess: () => void;
  refreshing: boolean;
}) {
  const can = (permission: Permission) => session.permissions.includes(permission);
  return (
    <AccessLayout>
      <div className="panel-heading">
        <div>
          <h3>{session.user.fullName}</h3>
          <p className="muted">{session.user.email}</p>
        </div>
        <button
          type="button"
          className="button secondary"
          onClick={refreshAccess}
          disabled={refreshing}
        >
          {refreshing ? "Checking…" : "Refresh access"}
        </button>
      </div>
      <p className="access-description">
        Your access is tied to <strong>{session.organization.name}</strong>. Your team’s other
        organizations have separate accounts and records.
      </p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Area</th>
              <th>View</th>
              <th>Create</th>
              <th>Edit</th>
            </tr>
          </thead>
          <tbody>
            {["clients", "invoices", "expenses", "retainers"].map((area) => (
              <tr key={area}>
                <td className="capitalize">{area}</td>
                {["read", "create", "update"].map((action) => (
                  <td key={action}>
                    <span
                      className={
                        can(`${area}:${action}` as Permission) ? "permission-yes" : "permission-no"
                      }
                    >
                      {can(`${area}:${action}` as Permission) ? "✓ Allowed" : "— Not allowed"}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="field-hint">
        Team management: {can("members:manage") ? "Allowed" : "Not allowed"}. Refresh access after
        your role is changed.
      </p>
    </AccessLayout>
  );
}
