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
  const rows: Array<[string, Permission, Permission | null, Permission | null]> = [
    ["Clients", "clients:read", "clients:create", "clients:update"],
    ["Invoices", "invoices:read", "invoices:create", "invoices:update"],
    ["Expenses", "expenses:read", "expenses:create", "expenses:update"],
    ["Recurring invoices", "retainers:read", "retainers:create", "retainers:update"],
    ["Vendors", "vendors:read", "vendors:manage", "vendors:manage"],
    [
      "Accounts payable",
      "accounts-payable:read",
      "accounts-payable:manage",
      "accounts-payable:manage",
    ],
    ["Employees", "employees:read", "employees:create", "employees:update"],
    ["Salary structures", "salaries:read", "salaries:manage", "salaries:manage"],
    ["Payroll", "payroll:read", "payroll:create", "payroll:manage"],
    ["Attendance", "attendance:read", "attendance:manage", "attendance:manage"],
    ["Leave", "leave:read", "leave:request", "leave:manage"],
    ["Overtime", "overtime:read", "overtime:request", "overtime:manage"],
    ["Cash flow", "cash-flow:read", null, "cash-flow:manage"],
    ["Banking", "banking:read", "banking:manage", "banking:manage"],
    ["Financial reports", "financial-reports:read", null, null],
    ["Team", "members:read", "members:manage", "members:manage"],
    ["Organization", "organization:read", null, "organization:update"],
  ];
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
              <th>Edit/manage</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([area, ...permissions]) => (
              <tr key={area}>
                <td>{area}</td>
                {permissions.map((permission, index) => (
                  <td key={index}>
                    <span
                      className={permission && can(permission) ? "permission-yes" : "permission-no"}
                    >
                      {permission === null
                        ? "Not applicable"
                        : can(permission)
                          ? "✓ Allowed"
                          : "— Not allowed"}
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
        your role is changed. This table summarizes area access; issuing, approvals, payments and
        exports have separate permissions enforced by the API.
      </p>
    </AccessLayout>
  );
}
