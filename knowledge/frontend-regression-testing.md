# Frontend Regression Testing

## Strategy

Frontend verification uses four complementary layers:

1. Pure behavior tests for validation, formatting, request helpers and domain utilities.
2. A dependency-free hook harness for state, effects, cleanup, filters and mutation coordination.
3. Source-contract tests for security- and concurrency-sensitive workflow guarantees that cannot be rendered without a DOM test framework.
4. The isolated Chrome/CDP runner for real browser coverage of invoice workflows.

The repository does not currently include a DOM component test framework, Playwright, Cypress, Jest, Vitest or repository-wide coverage instrumentation. Coverage is therefore reported qualitatively rather than as invented percentages.

## Automated inventory

- Test files included by the frontend script: 16.
- Declared test cases: 78.
- Existing cases before this audit: 50.
- New cases: 28.
- Separate browser runner: `apps/web/test/invoice.browser.mjs`.

The new tests cover:

- Login field constraints, normalized credentials, session handoff, staged registration validation and password visibility.
- Banking record loading/default selection/filtering and reconciliation save-refresh ordering.
- Banking failure recovery and confirmation-gated, versioned reconciliation reversal.
- Expense filter application, pagination reset and date-range query generation.
- Expense failure handling and loading completion.
- Financial-summary request cancellation and explicit reload behavior.
- Payroll selection loading details and workforce review together, including failure recovery.
- Employee directory filtering across search, status and department.
- Workspace legacy pagination, request cancellation, self-managed request suppression and theme persistence.
- Employee workspace permissions, employee create/update request shape and salary versioning.
- Recurring workspace and occurrence-history request coordination.
- Attendance failed-dialog behavior and versioned review.
- Leave and overtime create-before-submit ordering.
- Payroll create-before-calculate ordering, versioning, idempotency and payslip contracts.
- Retainer versioned transitions and schedule-scoped retries.

## Feature coverage matrix

| Feature             | Assessment               | Automated coverage                                                                  | Browser coverage                         | Outstanding risk                                                               |
| ------------------- | ------------------------ | ----------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------ |
| Authentication      | Partial                  | Validation contracts, normalization, errors, session handoff, password toggle       | Login succeeds during invoice runner     | Registration UI, invalid login and redirect behavior need browser checks       |
| Banking             | Partial                  | Loading, default account, filtering and reconciliation ordering                     | None                                     | Import, reverse reconciliation, batches and stale overlapping loads            |
| Expenses            | Partial                  | Form/receipt validation, permission controls, filters and pagination query          | None                                     | CRUD, uploads and approval workflows are not browser verified                  |
| Accounts Payable    | Minimal                  | Bill/vendor filtering and sorting                                                   | None                                     | Vendor, bill, payment and aging workflows                                      |
| Cash Flow           | Minimal                  | Chart/label utilities                                                               | None                                     | Scenario, horizon, settings, refresh and event rendering                       |
| Financial Dashboard | Partial                  | Presets, presentation contracts and request cancellation                            | None                                     | Custom-range interaction, charts, loading and empty states                     |
| Invoices            | Well covered             | Validation, payloads, versions, permissions, payments, PDF and session behavior     | Full isolated invoice workflow           | Other browser sizes and accessibility automation                               |
| Retainers           | Partial                  | Labels, coordinated loads, version/retry contracts                                  | None                                     | Form interaction, transitions and optimistic conflicts                         |
| Attendance          | Minimal                  | Mutation/dialog and optimistic-version contracts                                    | None                                     | Timestamp, manager recording and correction UI                                 |
| Leave               | Minimal                  | Create-submit ordering and version contracts                                        | None                                     | Half-day behavior, permissions, balances and approvals                         |
| Leave Policies      | Not covered behaviorally | None beyond compilation                                                             | None                                     | Policy forms, accrual preview/run and adjustments                              |
| Overtime            | Minimal                  | Create-submit ordering, optional values and versions                                | None                                     | Minute entry, duplicate-day errors and approvals                               |
| Employees           | Partial                  | Permission-aware loading, request shapes and salary versioning                      | None                                     | Dialog validation, departments, termination and manager assignment             |
| Payroll             | Partial                  | Run selection, workforce review, ordering, versions, payments and payslip contracts | None                                     | Approval identities, finalization, recovery, partial payments and statutory UI |
| Workspace           | Partial                  | Navigation, pagination, cancellation, theme initialization/persistence              | Invoice navigation and theme persistence | Notifications, project selection and permission controls                       |
| Reports             | Minimal                  | Presentation/export contracts                                                       | None                                     | Period interaction, chart states and downloads                                 |
| Onboarding          | Partial                  | Progress, permissions, targets, viewport placement and replay                       | Tour appears during invoice runner       | Full interactive completion and resume flow                                    |

## Confirmed regressions and fixes

No application regression was confirmed by the checks performed. This does not establish that none exist.

The existing browser QA runner had three confirmed test-harness regressions:

1. It expected the invoice client field to be a native `select`, but the application now uses the shared accessible dropdown. The assertion now checks the dropdown trigger’s selected-client label.
2. It selected the first dialog in the DOM instead of the visible delete dialog. Delete assertions now target `.invoice-delete-dialog[open]`.
3. The generic `Cancel` action could target a control belonging to another workflow. Delete confirmation cancellation is now scoped to the open delete dialog.

These changes update only test selectors and do not alter application behavior.

## Browser results

The repository’s Chrome/CDP runner was executed against a uniquely named local PostgreSQL database after its selector contracts were updated. The final run passed:

- API signup and browser login.
- Invoice detail and exact amounts.
- Edit prepopulation and line-item operations.
- Save network failure and retry.
- Optimistic conflict and explicit reload.
- Delete confirmation, cancellation and conflict recovery.
- Invoice-list expansion and deletion.
- Project-manager and finance-viewer restrictions.
- Desktop and 390-pixel mobile overflow assertions.
- Theme persistence across a full browser reload, followed by restoration.
- Not-found navigation and uncaught browser exception check.

Screenshots are stored in `/tmp/puffinpal-invoice-browser`.

The runner intentionally retains isolated databases. Nine uniquely named `puffinpal_browser_test_*` databases were created during selector and theme-test diagnosis and the passing runs. They were not reset or deleted. The development database was not modified.

No other feature received browser verification.

## Coverage results

Statement, branch, function and line percentages are unavailable because repository-wide coverage instrumentation is not configured. Node’s test runner executes the suite, but the project has no inclusion map for unimported frontend modules; reporting its loaded-module coverage would misrepresent whole-application coverage.

The feature matrix above is the supported coverage assessment.

## Manual regression checklist

Use a non-production organization with disposable records.

### Authentication

1. Submit blank and malformed login values; browser validation must block submission.
2. Submit invalid credentials; the error must remain visible and inputs must remain usable.
3. Log in successfully; the workspace must load and protected routes must not flash unauthenticated content.
4. Complete all registration steps, including back/forward transitions and mismatched passwords.
5. Toggle password visibility and verify focus and accessible labels.

### Finance

1. Create a bank account, import a valid/invalid CSV, filter transactions, reconcile and reverse a match.
2. Create, edit and delete an expense; upload, preview and download a receipt.
3. Submit, approve and reject an expense using users with appropriate roles.
4. Create/edit a vendor, create a bill and record partial and final payments; confirm aging totals.
5. Switch forecast scenarios and horizons, save settings and confirm events and totals refresh.
6. Exercise dashboard presets and custom ranges, including reversed/invalid dates and empty data.
7. Create, edit, pause, resume and cancel a retainer; retry a failed occurrence.
8. Change report periods and download CSV/PDF exports.

### Workforce

1. Check in/out, record manager attendance and submit/review a correction.
2. Create full- and half-day leave requests and approve/reject them with another authorized user.
3. Create a leave policy, preview/process accruals and record a balance adjustment.
4. Create and submit overtime with and without compensation overrides; approve and reject it.
5. Create/edit an employee, manage departments/managers/salary and terminate employment.

### Payroll

1. Generate a draft and verify workforce imports and displayed earnings/deductions.
2. Submit with one user and confirm self-approval is rejected.
3. Approve/finalize with an authorized second user.
4. Record partial and final payments, retry a failed payslip and download the completed PDF.
5. Create/edit/pause payroll automation and configure/preview/apply statutory rules.
6. Force a stale version and verify recovery preserves a clear actionable error.

### Workspace

1. Visit every top/side navigation destination and use browser back/forward.
2. Exercise legacy pagination where present.
3. Open/close invoice dialogs and confirm focus returns correctly.
4. Toggle theme, reload, and confirm persistence with and without reduced motion.
5. Open notifications, dismiss/read one and verify permission-restricted controls are absent.

## Outstanding risks and recommended tests

- Add a DOM component harness such as Testing Library only as a deliberate dependency decision.
- Add isolated browser workflows for banking, expenses, retainers, attendance, leave, employees and payroll.
- Add request-generation guards or cancellation tests for overlapping `useBankingRecords`, `useExpenseCollection`, `useEmployeeDirectory.refresh` and `usePayrollRuns.open` calls. These are risks, not confirmed regressions.
- Add accessibility automation for dialogs, dropdowns, date pickers, focus restoration and keyboard-only use.
- Configure repository-wide coverage with explicit inclusion of all `apps/web/src` files before adopting percentage thresholds.

## Verification commands

```sh
cd apps/web
pnpm test

cd ../..
pnpm check-types
pnpm lint
pnpm build
git diff --check

cd apps/api
node scripts/test-invoice-browser.mjs
```
