# MVP scope freeze — Batch 6 (2026-11-11)

Batch 7 clarification: this is a personal portfolio project, not a commercial launch.
The scope remains frozen. “Before release” and “post-launch” below describe the earlier
planning categories; optional deferred features are not required for portfolio completion.
Use [the demo guide](portfolio-demo-guide.md) for the final presentation checks.

The MVP is an operational finance and workforce workspace: organization-scoped accounts
and roles, clients, draft/issued invoices and recorded partial payments/PDFs, recurring
invoices, vendors and bill approvals/payments/reversals, expense approvals/settlements,
currency-isolated dashboards/reports/exports, fixed-salary full-period payroll/payslips,
employees/salaries, attendance/leave/overtime, and existing background jobs.

## A. Must fix before release — selected issues

1. Payroll draft recovery: creation persists before calculation. A calculation failure
   leaves the creation dialog able to create another run, while an empty saved draft
   has no employee-selection recovery path. Preserve the saved draft and allow calculation
   retries and recovery using existing APIs.
2. Payment checklist ambiguity: the banking “Mark paid” action only updates checklist
   status, and cancelling its reference prompt still submits. Make checklist-only semantics
   explicit, preserve cancellation, and point authorized users to payroll payment recording.
3. Team permissions: read-only roles see a member-creation form with no assignable roles.
   Show account provisioning only to roles allowed to assign members.

All three selected issues are fixed. Payroll calculation retries retain the acknowledged
saved draft ID and refetch its current version; empty drafts reopen employee selection.
Saved draft metadata and inputs are protected while busy, and closing a failed calculation
refreshes the run list. Checklist completion now has an explicit cancellable confirmation,
a bounded optional reference, and a permission-aware Payroll link. Team creation is shown
only when roles are assignable. These are the only Batch 6 implementation changes; backend
financial lifecycle, permissions, schema and audit behavior are unchanged.

Focused event-handler tests cover calculation failure/retry (one creation), latest-version
use, saved-empty-draft recovery, checklist cancellation/confirmation and all four team roles.
Existing workflow contracts, web TypeScript, targeted lint and diff checks pass. No backend
code changed, so database integration and API recompilation were not required for this batch.
Interactive browser checks remain pending. A lost response to the initial draft-creation
request is not an idempotency guarantee; verify saved runs before intentionally creating a
replacement. Invitation/recovery, immutable-payment correction policy and capped-list scale
are release-readiness triage risks below, not additional fixes selected for this batch.

## B. Post-launch improvements

- Invitations/email verification/recovery automation; launch uses administrator-provisioned
  accounts with private credential handoff and existing password change. No email invite is promised.
- Invoice/payroll payment reversals, credit notes and issued-document correction policies.
  Existing invoice/payroll payments remain immutable and require careful review.
- Hourly/prorated payroll, additional automation, recurring holiday expansion, leave accrual
  scheduling, retroactive workforce adjustments, and advanced customization.
- Broad pagination beyond completed AP/expense lists, bank account maintenance UI,
  unified audit feeds, more notifications, optional analytics, and dialog consistency.
- Vendor restoration and rejected-bill field reopening beyond existing supported lifecycles.
- Legacy retainer migration, ownership transfer, self-service account closure/deactivation,
  per-device session controls, and organization switching beyond existing organization login.

## C. Explicitly out of scope

New modules, general ledger/statutory financial statements, bank feeds or automated transfers,
payment gateways, complex reconciliation, maintained country tax engines, FX conversion,
AI assistants, project/time billing, analytics platforms, and infrastructure expansion.
Existing organization-configured payroll rules and one-to-one reconciliation remain supported.

## Release-readiness gate

Next work is verification and deployment preparation, not another feature batch: browser-smoke
core flows with owner/admin/read-only roles; exercise PDFs, exports and worker recovery;
validate normal migration deployment, secrets, backup/restore evidence and operational runbooks.
Confirm the initial-password and no-self-service-recovery launch policy with the operator;
if self-service recovery/email invitations are required for launch, treat that as a release
policy blocker rather than silently expanding this batch. Verify correction/support procedures
for immutable invoice/payroll payments. Existing first-100 loaders outside AP/expenses require
scale triage against launch customer sizes; do not claim complete large-organization coverage.
