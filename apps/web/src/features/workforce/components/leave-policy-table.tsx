import type { LeaveType } from "../types";
import type { LeavePolicy } from "./leave-policy-components";

export function LeavePolicyTable({
  policies,
  types,
  onPreview,
  onProcess,
}: {
  policies: LeavePolicy[];
  types: LeaveType[];
  onPreview: (id: string) => void;
  onProcess: (id: string) => void;
}) {
  if (!policies.length)
    return (
      <div className="empty-state">
        <h3>No accrual policies</h3>
        <p>Create a policy to accrue exact leave minutes without changing historical entries.</p>
      </div>
    );
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Policy</th>
            <th>Frequency</th>
            <th>Entitlement</th>
            <th>Carry-forward</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {policies.map((policy) => (
            <tr key={policy.id}>
              <td>
                <strong>{policy.name}</strong>
                <small className="muted payroll-subtitle">
                  {types.find((type) => type.id === policy.leaveTypeId)?.name}
                </small>
              </td>
              <td>{policy.frequency.replaceAll("_", " ")}</td>
              <td>{(policy.entitlementMinutes / 60).toFixed(1)} hours/year</td>
              <td>{policy.carryForwardMode.replaceAll("_", " ")}</td>
              <td>{policy.isActive ? "Active" : "Inactive"}</td>
              <td>
                <div className="row-actions">
                  <button className="text-button" onClick={() => onPreview(policy.id)}>
                    Preview
                  </button>
                  <button className="text-button" onClick={() => onProcess(policy.id)}>
                    Run accrual
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
