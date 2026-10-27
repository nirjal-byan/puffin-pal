import type { Permission } from "@puffinpal/permissions";
import { AppModal } from "@/components/ui/app-modal";
import type { WorkspaceApi } from "@/lib/api";
import type { PayrollDetails, PayrollEntry, WorkforceReview } from "../types";
import { PayrollEntriesTable } from "./payroll-entries-table";
import { PayrollStatutory } from "./payroll-statutory";
import { PayrollWorkforceReview } from "./payroll-workforce-review";

type PayrollAction = "calculate" | "submit" | "approve" | "finalize";

export function PayrollRunDetails({
  api,
  run,
  reviews,
  permissions,
  busy,
  onClose,
  onAction,
  onReject,
  onImportOvertime,
  onImportUnpaidLeave,
  onAdjustment,
  onPayment,
  onDownload,
  onRetryPayslip,
  onRefresh,
}: {
  api: WorkspaceApi;
  run: PayrollDetails;
  reviews: WorkforceReview[];
  permissions: readonly Permission[];
  busy: boolean;
  onClose: () => void;
  onAction: (action: PayrollAction) => void;
  onReject: () => void;
  onImportOvertime: (entry: PayrollEntry, overtimeId: string) => void;
  onImportUnpaidLeave: (entry: PayrollEntry, leaveRequestId: string) => void;
  onAdjustment: (entry: PayrollEntry) => void;
  onPayment: (entry: PayrollEntry) => void;
  onDownload: (entry: PayrollEntry) => void;
  onRetryPayslip: (entry: PayrollEntry) => void;
  onRefresh: () => Promise<void>;
}) {
  const can = (permission: Permission) => permissions.includes(permission);
  return (
    <AppModal wide title={run.name} badge={run.status.replaceAll("_", " ")} onClose={onClose}>
      <div className="payroll-detail">
        <div className="payroll-summary">
          <div>
            <small>Gross</small>
            <strong>
              {run.currency} {run.totalGross}
            </strong>
          </div>
          <div>
            <small>Deductions</small>
            <strong>
              {run.currency} {run.totalDeductions}
            </strong>
          </div>
          <div>
            <small>Net pay</small>
            <strong>
              {run.currency} {run.totalNet}
            </strong>
          </div>
        </div>
        <div className="form-actions payroll-actions">
          {run.status === "DRAFT" && can("payroll:manage") && (
            <>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => onAction("calculate")}
              >
                Calculate
              </button>
              <button
                className="button primary"
                disabled={busy || run.employeeCount < 1}
                onClick={() => onAction("submit")}
              >
                Submit for approval
              </button>
            </>
          )}
          {run.status === "PENDING_APPROVAL" && can("payroll:approve") && (
            <>
              <button className="button secondary" disabled={busy} onClick={onReject}>
                Return to draft
              </button>
              <button
                className="button primary"
                disabled={busy}
                onClick={() => onAction("approve")}
              >
                Approve
              </button>
            </>
          )}
          {run.status === "APPROVED" && can("payroll:finalize") && (
            <button className="button primary" disabled={busy} onClick={() => onAction("finalize")}>
              Finalize payroll
            </button>
          )}
        </div>
        {can("payroll:manage") && run.status === "DRAFT" && (
          <PayrollStatutory api={api} run={run} onApplied={onRefresh} />
        )}
        <PayrollWorkforceReview
          run={run}
          reviews={reviews}
          busy={busy}
          onImportOvertime={onImportOvertime}
          onImportUnpaidLeave={onImportUnpaidLeave}
        />
        <PayrollEntriesTable
          run={run}
          busy={busy}
          canManage={can("payroll:manage")}
          canRecordPayments={can("payroll:payments:record")}
          onAdjustment={onAdjustment}
          onPayment={onPayment}
          onDownload={onDownload}
          onRetryPayslip={onRetryPayslip}
        />
      </div>
    </AppModal>
  );
}
