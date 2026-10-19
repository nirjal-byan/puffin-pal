# Payroll management

PuffinPal payroll uses effective-dated employee salary structures to calculate auditable pay runs. This release supports fixed salaries with fixed earning and deduction components. Hourly structures and employees who do not cover the complete pay period are rejected because the application does not yet have trusted hours or an organization-specific proration policy.

## Workflow

1. Create a draft with a pay period and payment date.
2. Calculate the draft. Every included employee must have exactly one salary structure that covers the complete period, uses the organization currency, and matches the period frequency.
3. Add any explicit earning or deduction adjustments while the run is a draft.
4. Submit the run for approval. The creator cannot approve their own run.
5. Approve or return the run to draft with a reason.
6. Finalize it. Employee, salary, component, and total snapshots become immutable. An employee cannot appear in another finalized run with an overlapping period.
7. The BullMQ worker renders each payslip from finalized snapshots and stores it privately in SeaweedFS. Failed jobs can be retried without changing payroll totals.
8. Record one or more manual payments. Idempotency keys prevent duplicate submissions and payments cannot exceed net pay.

## Security and storage

All API reads and writes derive the organization from the authenticated request. Payroll tables use composite organization foreign keys. Payslip object keys use `organizations/{organizationId}/payroll/{runId}/{entryId}/{random}.pdf`; keys never leave the API. Downloads validate tenant ownership, object metadata, content type, PDF signature, and SHA-256 integrity.

Permissions are `payroll:read`, `payroll:create`, `payroll:manage`, `payroll:approve`, `payroll:finalize`, and `payroll:payments:record`. OWNER and ADMIN receive operational permissions; FINANCE_VIEWER has read-only access.

## Data and calculation rules

`PayrollRun` owns organization, period, approval/finalization actors, currency, snapshot organization name, totals, and optimistic version. `PayrollEntry` snapshots the employee identity, job, salary structure, frequency, and calculated amounts. `PayrollEntryComponent` snapshots regular components and one-time adjustments. `PayrollPayment` is append-only and idempotent. `PayrollAuditEvent` records the actor and significant transition.

Money is converted to integer cents for arithmetic and stored as `Numeric(14,2)`. No floating-point calculation is used and no additional rounding is needed for fixed two-decimal components. Monthly runs must cover a complete calendar month; weekly and biweekly runs must contain exactly 7 and 14 inclusive calendar dates. Draft overlaps are allowed for planning. Finalization rejects an employee already present in an overlapping finalized run.

Finalization rechecks employment dates and status, the effective salary, currency, components, and aggregate totals under a database lock. Salary changes require returning the run to draft and recalculating. Finalized snapshots and payment history remain after an employee is terminated.

## Worker operation

Start the API with `pnpm --filter @puffinpal/api dev` and the independent worker with `pnpm --filter @puffinpal/api dev:worker`. Set `PAYROLL_WORKER_CONCURRENCY` from 1 to 10 (default 2). The queue uses the existing `BULLMQ_REDIS_URL` and `BULLMQ_PREFIX` namespace, retries five times with exponential backoff, and retains bounded completed and failed job metadata.

The additive migration under `apps/api/prisma/migrations/app/20261019T0433_migration` must be reviewed and applied through the normal deployment process before using payroll endpoints. It is not applied automatically.

## Reporting and limitations

Payroll obligations and recorded payroll payments are currently reported in the Payroll section. Existing dashboard KPI definitions are unchanged, so payroll payments are not yet included in cash-outflow charts and cannot be double-counted with expenses. There are no tax, statutory contribution, overtime, attendance, bank transfer, payment reversal, or automatic recurring-payroll features. Reversals require a future explicit append-only reversal workflow.

## Manual verification

1. Review and apply both pending payroll migrations through the normal deployment process.
2. Create two administrator users, an active fixed-salary employee, and one salary structure matching a complete pay period.
3. Create and calculate a run; verify earnings, deductions, and net totals.
4. Submit with one administrator and verify that user cannot self-approve; approve with the other.
5. Change a salary before finalization and confirm finalization is blocked until recalculation. Then approve and finalize again.
6. Start the worker, wait for the payslip status to become completed, and download the PDF. Stop Redis or SeaweedFS to verify the visible failed status and retry action.
7. Record a partial payment, verify the outstanding amount, then record the remainder. Repeat the same idempotency key through the API and confirm no duplicate.
8. Sign in to another organization and verify that guessed run, entry, payment, and payslip identifiers return no data.
