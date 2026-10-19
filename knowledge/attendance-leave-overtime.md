# Attendance, leave, and overtime

PuffinPal’s workforce module records daily attendance, effective-dated work schedules, configurable holidays, leave requests and balances, and approved overtime. Every query derives the organization from the authenticated JWT context.

## Attendance

One canonical record exists per employee and local work date. Managers can record `PRESENT`, `ABSENT`, `HALF_DAY`, `ON_LEAVE`, or `HOLIDAY`. Lateness is a separate flag. Self check-in and check-out use server instants; an employee must be linked to the authenticated user. Worked duration is stored in integer minutes. Missing records remain warnings and are never converted into absences.

Schedules store IANA timezone names, ISO weekday numbers, local start/end times, expected minutes, and effective dates. Overlapping schedules are rejected. Overnight attendance is supported up to 24 hours; longer open records require manager correction. This phase does not provide shift rostering.

## Leave

Organizations configure leave types without jurisdiction-specific assumptions. Allowances and usage use integer half-day units. Requests count scheduled workdays and exclude configured holidays. Approval writes an append-only ledger deduction; cancellation writes a restoration. Unique request/kind constraints prevent duplicate balance deductions.

Workflow: `DRAFT → PENDING_APPROVAL → APPROVED` or `REJECTED`; drafts, pending requests, and approved requests may be cancelled under explicit rules. Reviewers cannot approve their own requests. Project managers are limited to direct reports.

## Overtime

Overtime requests preserve requested and approved integer minutes. Approval snapshots the configured hourly rate. Worked attendance never creates or approves overtime automatically. Payable overtime uses exact scaled integer arithmetic and an optional multiplier; no statutory multiplier is assumed.

## Payroll integration

Draft payroll exposes recorded attendance, missing-record warnings, approved paid and unpaid leave, unresolved requests, and approved overtime. Missing attendance and unpaid leave never create automatic deductions. A payroll manager may explicitly import approved overtime with a rate into one draft entry. A database uniqueness constraint prevents importing the source request again, including into another run. Finalized payroll remains immutable.

## Permissions and audit

Owners and administrators receive the full workforce permission set. Project managers can manage attendance and approve direct-report leave/overtime. Finance viewers receive read-only workforce access. Linked users may use self-service attendance and request flows. Audit events record actor, employee, entity, action, timestamp, and compact metadata.

## API

- Attendance: `GET/POST /api/v1/attendance`, check-in/out, summary, schedules, holidays.
- Leave: types, requests, balances, submit/approve/reject/cancel transitions under `/api/v1/leave`.
- Overtime: list/create and submit/approve/reject/cancel under `/api/v1/overtime`.
- Payroll: `GET /api/v1/payroll/runs/:id/workforce-review` and explicit overtime import.

## Manual verification

1. Apply the pending additive migration in a disposable environment.
2. Link a user to an employee and configure an effective schedule.
3. Check in and out; verify server timestamps and worked minutes.
4. Configure a holiday and leave type, submit a weekend-spanning request, and verify units.
5. Approve, cancel, and confirm ledger-backed balances.
6. Approve overtime with a rate, create a draft payroll, import it once, and verify a duplicate is rejected.
7. Confirm another organization cannot read or mutate any record IDs.

## Known limitations

The default summary assumes Monday–Friday when an employee schedule is unavailable. Recurring holidays are stored but expansion by year is not automated. Leave accrual, carry-forward, automatic unpaid-leave deductions, advanced shift rostering, GPS, biometrics, and statutory compliance are outside this phase.
