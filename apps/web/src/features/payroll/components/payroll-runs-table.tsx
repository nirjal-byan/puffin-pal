import type { PayrollRun } from "../types";

export function PayrollRunsTable({
  runs,
  onOpen,
}: {
  runs: PayrollRun[];
  onOpen: (run: PayrollRun) => void;
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <h3>Payroll history</h3>
        <span className="muted">{runs.length} total</span>
      </div>
      {runs.length === 0 ? (
        <div className="empty-state">
          <span className="empty-symbol">$</span>
          <h3>No pay runs yet</h3>
          <p>Create a draft when your team’s salary structures are ready.</p>
        </div>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Run</th>
                <th>Period</th>
                <th>Employees</th>
                <th>Net payroll</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id}>
                  <td>
                    <strong>{run.name}</strong>
                    {run.payrollScheduleId && (
                      <small className="payroll-subtitle muted">Automated draft</small>
                    )}
                  </td>
                  <td>
                    {run.periodStart.slice(0, 10)} – {run.periodEnd.slice(0, 10)}
                  </td>
                  <td>{run.employeeCount}</td>
                  <td>
                    {run.currency} {run.totalNet}
                  </td>
                  <td>
                    <span className="role-badge">{run.status.replaceAll("_", " ")}</span>
                  </td>
                  <td>
                    <button className="text-button" onClick={() => onOpen(run)}>
                      View
                    </button>
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
