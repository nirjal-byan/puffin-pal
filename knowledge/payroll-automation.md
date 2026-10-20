# Payroll automation

Payroll automation prepares calculated **draft** pay runs. It never approves, finalizes, pays, imports overtime, or creates final payslips without an authorized user completing the existing payroll workflow.

## Architecture

Each organization may configure one `PayrollSchedule`. The API persists schedule state in PostgreSQL and registers a BullMQ scan job on the existing `BULLMQ_REDIS_URL` connection and `BULLMQ_PREFIX` namespace. The independent worker scans at one-minute intervals, creates a unique `PayrollScheduleOccurrence`, and queues a minimal payload containing only the organization and occurrence IDs.

The worker reloads all authoritative records, creates a `PayrollRun`, and calls the existing payroll calculation service. Generated runs remain `DRAFT` and are marked with `payrollScheduleId`. The occurrence stores the resulting run ID and a safe outcome. Redis is transport only; PostgreSQL remains the source of truth.

## Schedule rules and timezones

- Weekly periods contain seven calendar days.
- Biweekly periods contain fourteen calendar days.
- Semimonthly periods are the 1st–15th and 16th–last day of the month.
- Monthly periods retain their starting day where possible and clamp to the last valid day in shorter months.
- `generationTime` is interpreted in the configured IANA timezone. Temporal timezone conversion preserves local wall-clock time across daylight-saving transitions.
- Draft generation is scheduled on the first calendar day after a period closes, at `generationTime` in that timezone.
- The optional payment offset is counted in calendar days from period end and is only an intended payment date on the draft.

Leap years and variable month lengths are calendar-derived. A semimonthly schedule must start on the 1st or 16th.

## Idempotency, conflicts, and recovery

`(organizationId, scheduleId, periodStart)` is unique for occurrences and `(organizationId, payrollScheduleId, periodStart)` is unique for generated runs. Payroll creation also takes a PostgreSQL transaction advisory lock per organization and rejects any overlapping existing run, including a manually created run. PuffinPal never changes or deletes the conflicting run.

BullMQ retries generation five times with bounded exponential backoff. An already generated occurrence returns its existing result. Failed attempts retain a safe failure category and can be retried through the manual generation action. Each scan advances at most one period per schedule, bounding recovery after downtime and queue growth.

## Permissions, notifications, and audit history

Users with `payroll:read` can view the schedule, history, and their own notifications. Users with `payroll:manage` can create, edit, pause, resume, and manually trigger a due schedule. Existing payroll permissions continue to control approval, finalization, payment, and payslips.

Draft-ready, approval-pending, and automation-failed notifications are stored per recipient for owners and administrators. A database dedupe key prevents duplicate delivery. Notification text contains no employee names or salary values. Automation history is tenant-scoped and paginated to a maximum of 100 records.

Approved overtime is intentionally not imported automatically. Review it through the existing workforce review before submitting the draft.

## Cash-flow behavior

Cash-flow forecasts include finalized payroll and, when configured, approved payroll. Draft runs are excluded, so an automated draft does not add a second payroll outflow. Existing salary projections continue to cover periods without approved or finalized payroll.

## Deployment

The migration chain is:

1. `20261020T1156_cash_flow_forecasting`
2. `20261020T1253_payroll_automation`

Do not deploy Task 16 before Task 15. Review status, then apply the existing chain:

```bash
cd apps/api
pnpm exec prisma migration status
pnpm run prisma:migrate:deploy
pnpm exec prisma migration status
```

Run the independent worker alongside the API:

```bash
pnpm --filter @puffinpal/api dev:worker
```

The payroll automation worker shares `PAYROLL_WORKER_CONCURRENCY` with payslip processing. No new environment variables are required.

## Manual testing

1. Apply pending migrations in order and start PostgreSQL, Redis, the API, web app, and worker.
2. Create active employees with one effective fixed-salary structure covering the test period.
3. Open Payroll, create a schedule whose first period is currently due, and verify the displayed next run uses the chosen timezone.
4. Select **Generate due draft**, confirm the draft-only dialog, and watch the worker log.
5. Refresh Payroll and verify one calculated `DRAFT` run, a generated history row, and a draft-ready reminder.
6. Repeat generation and restart the worker; verify no duplicate run appears.
7. Submit the draft and verify an approval-pending reminder. Confirm approval and finalization still require their existing permissions.
8. Create an overlapping manual run for a later test period and verify automation records a conflict without modifying it.
9. Pause the schedule and verify scans do not generate drafts; resume it and verify processing continues.

## Known limitations

- One payroll schedule is supported per organization; employee groups with different cadences are not yet supported.
- Email delivery and “period approaching” reminders are deferred. Notifications are currently in-app only.
- Automated drafts do not import overtime or apply leave deductions.
- Hourly salary payroll remains unsupported by the existing payroll calculation workflow.
