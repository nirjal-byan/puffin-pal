# Payroll tax and statutory deductions

PuffinPal provides a configurable calculation framework. Saved rules are not guaranteed to comply with any jurisdiction. A qualified payroll or tax professional must verify configuration before production use.

## Architecture and versioning

An organization configures one active country/subdivision jurisdiction and currency. Rule sets are effective-dated drafts containing progressive brackets and flat employee/employer rules. Activation rejects overlapping active periods. Activated versions are retained and cannot be edited in place; create a new version for changes.

Salary components require an explicit statutory classification: taxable earning, non-taxable earning, pre-tax deduction, or post-tax deduction. Base salary is taxable. Overtime is snapshotted as taxable and imported unpaid leave as a pre-tax deduction. Missing classifications block application rather than being guessed.

## Exact calculations

Money uses integer cents and rates use decimal millionths. Progressive brackets apply marginal rates only to income inside each bracket. Brackets must start at zero, remain contiguous, and end with an open bracket. Progressive rules require an explicit periods-per-year annualization method.

`net pay = gross earnings - pre-tax deductions - tax withholding - employee contributions - post-tax deductions`

`employer payroll cost = gross earnings + employer contributions`

Employer contributions never reduce net employee pay. Rule bases, thresholds, maximum bases, and contribution caps are snapshotted with the applied result.

## Preview and apply

Scheduled and manual payroll runs remain drafts without statutory deductions. An authorized payroll manager selects an active rule version, previews every entry, resolves missing classifications, and explicitly applies the preview. Apply locks the payroll run, checks its optimistic version and preview hash, writes one immutable application per entry, and creates itemized payroll components. Duplicate or stale application is rejected.

When `mandatoryCalculation` is enabled, submission, approval, and finalization are blocked until every entry has a statutory application. Otherwise the existing workflow remains available. Finalized payslips use component snapshots and show employer contributions separately.

Historical statutory reporting reads only finalized payroll application snapshots. It is an operational summary, not an official filing. Cash-flow continues to use employee net-pay obligations; employer contribution snapshots are separately identifiable and are not assigned invented remittance dates.

## RBAC, tenant boundaries, and audit

`payroll:read` can view configuration and reports. `payroll:manage` can configure, activate, classify, preview, and apply. Every query derives organization scope from authentication. Jurisdiction changes, rule creation/activation, classifications, and applications create statutory audit events without recording individual salary values.

## Migration and manual testing

Deploy Task 17 before Task 18. Review status, apply approved migrations, then verify zero pending migrations:

```bash
cd apps/api
pnpm exec prisma migration status
pnpm run prisma:migrate:deploy
pnpm exec prisma migration status
```

Manual checks:

1. Configure a jurisdiction and professional-reviewed rates.
2. Create and activate a rule version; confirm an overlapping version is rejected.
3. Calculate a payroll draft and preview statutory results.
4. Resolve all component classifications and preview again.
5. Apply once, confirm the gross-to-net reconciliation, and confirm a duplicate application is rejected.
6. Enable mandatory calculation and confirm an unapplied draft cannot be submitted.
7. Finalize through the normal workflow and inspect the itemized payslip and statutory report.

Known limitations: the first version supports one active jurisdiction per organization, period-based annualization rather than cumulative YTD withholding, no opening YTD balance, no remittance scheduling, no government filing integration, and no automatic statutory application.
