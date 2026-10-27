import type { PayrollDetails, PayrollEntry } from "../types";

export function PayrollEntriesTable({
  run,
  busy,
  canManage,
  canRecordPayments,
  onAdjustment,
  onPayment,
  onDownload,
  onRetryPayslip,
}: {
  run: PayrollDetails;
  busy: boolean;
  canManage: boolean;
  canRecordPayments: boolean;
  onAdjustment: (entry: PayrollEntry) => void;
  onPayment: (entry: PayrollEntry) => void;
  onDownload: (entry: PayrollEntry) => void;
  onRetryPayslip: (entry: PayrollEntry) => void;
}) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Employee</th>
            <th>Gross</th>
            <th>Deductions</th>
            <th>Net</th>
            <th>Payment</th>
            <th>Payslip</th>
          </tr>
        </thead>
        <tbody>
          {run.entries.map((entry) => (
            <tr key={entry.id}>
              <td>
                <strong>{entry.employeeName}</strong>
                <small className="muted payroll-subtitle">
                  {entry.employeeCode} · {entry.jobTitle}
                </small>
                {run.status === "DRAFT" && canManage && (
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() => onAdjustment(entry)}
                  >
                    + Adjustment
                  </button>
                )}
              </td>
              <td>{entry.grossPay}</td>
              <td>{entry.totalDeductions}</td>
              <td>{entry.netPay}</td>
              <td>
                {entry.paymentStatus}
                {entry.payments.map((payment) => (
                  <small className="muted payroll-subtitle" key={payment.id}>
                    {payment.paymentDate.slice(0, 10)} · {run.currency} {payment.amount} ·{" "}
                    {payment.reference}
                  </small>
                ))}
                {run.status === "FINALIZED" &&
                  entry.outstandingAmount !== "0.00" &&
                  canRecordPayments && (
                    <button className="text-button" onClick={() => onPayment(entry)}>
                      Record
                    </button>
                  )}
              </td>
              <td>
                {entry.payslipStatus === "COMPLETED" ? (
                  <button className="text-button" onClick={() => onDownload(entry)}>
                    Download
                  </button>
                ) : entry.payslipStatus === "FAILED" && canManage ? (
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() => onRetryPayslip(entry)}
                  >
                    Retry
                  </button>
                ) : (
                  entry.payslipStatus
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
