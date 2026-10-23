# Advanced workforce management

Task 17 extends the existing workforce and payroll modules. It does not create a parallel attendance, leave, schedule, or payroll engine. Every database query is scoped by the organization in the authenticated tenant context.

## Timezones and calendar dates

Organizations have an IANA `timezone`, defaulting safely to `UTC`. An effective employee work schedule takes precedence over the organization timezone; otherwise workforce operations use the organization timezone. Payroll automation schedules retain their own explicitly configured timezone. Timestamps remain UTC instants in PostgreSQL, while holidays, work dates, and payroll periods retain local-date semantics. Changing a timezone does not rewrite attendance or finalized payroll.

## Holidays and schedules

Authorized administrators can create one-time or annually recurring holidays, specify an optional partial-day duration, and edit or delete future holidays. Historical holidays and holidays covered by finalized payroll cannot be changed or deleted. Recurring February 29 holidays are emitted only in leap years.

Work schedules are effective-dated employee assignments with a name, workdays, local start/end time, unpaid break minutes, expected work minutes, timezone, active state, and optimistic version. Overlapping assignments for the same employee are rejected. Deactivation preserves history. Attendance and leave calculations select the newest active schedule effective on the relevant date.

## Leave policies and exact balances

Accrual policies support annual grants, monthly installments, and completed service months. Annual policies may prorate a midyear joiner by remaining calendar months. Entitlements, caps, carry-forward, expiration, requests, and adjustments use integer minutes. Legacy half-day ledger units remain readable and are converted using the employee's effective expected daily minutes where possible.

Accrual processing first supports a read-only preview. Processing is permission restricted, serialized per organization with a PostgreSQL advisory transaction lock, and protected by deterministic ledger idempotency keys. Repeating the same run cannot create the same accrual, carry-forward, or expiration twice.

At a year boundary, the engine writes separate expiration and carry-forward entries. Carry-forward may be disabled, full, or capped. Approved future leave is preserved above a configured cap when necessary. Expiring carry-forward removes only the available portion after approved future reservations. Manual changes append an audited adjustment entry; balances are never overwritten.

## Attendance corrections

Employees request corrections against their own attendance record. A request stores the original snapshot and proposed values. Only one pending request may exist for a record. Managers may review direct reports and cannot approve their own request. Review uses an optimistic version.

When a record falls inside finalized payroll, approval records `payrollImpact=true` and preserves the attendance record for an explicit future adjustment. Other approvals update attendance and increment its version. Rejections retain the reason and complete history.

## Workforce calendar and access

The Workforce page offers month and week views, an employee filter, attendance, pending and approved leave, holidays, effective schedules, and approved overtime. Calendar API ranges are bounded to 63 days. Owners and administrators receive organization scope; project managers are limited to themselves and direct reports. Employee self-service endpoints remain limited to the linked employee.

## Unpaid leave and payroll

Unpaid leave deductions are disabled by default at the organization level. An authorized payroll user must:

1. Open a draft payroll run.
2. Review eligible approved unpaid leave.
3. Explicitly import each selected deduction.
4. Continue through the existing approval and finalization workflow.

The deduction uses the entry's effective salary snapshot and scheduled minutes for the payroll period:

`deduction = round(gross pay × unpaid leave minutes ÷ scheduled minutes)`

Exact decimal arithmetic is used and the deduction is capped at current net pay. A unique source-leave constraint prevents duplicate imports. The transaction checks the draft version and refuses finalized runs. Automated payroll creates drafts and exposes review opportunities; it never imports leave, approves, or finalizes automatically.

## Migration deployment

Task 17 follows `20261020T1253_payroll_automation` and must be deployed after all earlier migrations. The generated migration is additive except for replacing the leave-ledger kind check constraint so it can admit the new accrual event values. It does not delete financial rows. Review status before deployment:

```bash
cd apps/api
pnpm exec prisma migration status
pnpm run prisma:migrate:deploy
pnpm exec prisma migration status
```

Do not use `db push`, reset the database, or mark a failed migration successful.

## Manual testing

1. Configure an organization timezone on People → Workforce.
2. Add a holiday, including recurring and partial-day examples; edit and delete a future entry.
3. Create a schedule, inspect it in the calendar, edit it, then deactivate it.
4. Create a leave type and accrual policy. Preview the accrual before running it twice and confirm the second run creates no duplicates.
5. Record a manual balance adjustment and confirm the balance breakdown changes.
6. Submit an attendance correction as a linked employee, then approve or reject it as an authorized manager.
7. Create approved unpaid leave, create a payroll draft, and explicitly import the offered deduction once. Confirm a second import is rejected.
8. Confirm a finalized payroll run and its covered attendance/holiday history cannot be mutated.

Known limitations: holiday targeting is organization-wide because the existing schema has no holiday-calendar assignment model. Schedule assignments remain employee-specific. Accrual processing is intentionally administrator initiated; no additional BullMQ schedule was introduced. These choices preserve the current architecture and avoid jurisdiction-specific assumptions.
