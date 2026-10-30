# Frontend Regression Testing

## Strategy

Frontend verification uses four complementary layers:

1. Pure behavior tests for validation, formatting, request helpers and domain utilities.
2. A dependency-free hook harness for state, effects, cleanup, filters and mutation coordination.
3. Source-contract tests for security- and concurrency-sensitive workflow guarantees that cannot be rendered without a DOM test framework.
4. The isolated Chrome/CDP runner for real browser coverage of authentication, Banking and invoice workflows.

The repository does not currently include a DOM component test framework, Playwright, Cypress, Jest, Vitest or repository-wide coverage instrumentation. Coverage is therefore reported qualitatively rather than as invented percentages.

## Automated inventory

- Test files included by the frontend script: 16.
- Declared test cases: 80.
- Existing cases before this audit: 50.
- New cases: 30.
- Separate browser runner: `apps/web/test/invoice.browser.mjs`.

The new tests cover:

- Login field constraints, normalized credentials, session handoff, staged registration validation and password visibility.
- Banking record loading/default selection/filtering and reconciliation save-refresh ordering.
- Banking failure recovery and confirmation-gated, versioned reconciliation reversal.
- Banking aggregate-load and reconciliation-suggestion request-race prevention.
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
| Authentication      | Browser verified         | Validation contracts, normalization, errors, session handoff, password toggle       | Full isolated authentication workflow    | Broader browser and assistive-technology combinations                          |
| Banking             | Browser verified         | Loading, filtering, mutation ordering and deterministic request-race coverage        | Isolated account/import/reconciliation UI | Populated payroll payment-batch mutation still requires browser verification    |
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

The browser expansion and deterministic race tests confirmed the login loading-label defect, two Banking stale-response defects and a browser-runner Redis isolation gap. Their reproductions and fixes are documented below.

The existing browser QA runner had three confirmed test-harness regressions:

1. It expected the invoice client field to be a native `select`, but the application now uses the shared accessible dropdown. The assertion now checks the dropdown trigger’s selected-client label.
2. It selected the first dialog in the DOM instead of the visible delete dialog. Delete assertions now target `.invoice-delete-dialog[open]`.
3. The generic `Cancel` action could target a control belonging to another workflow. Delete confirmation cancellation is now scoped to the open delete dialog.

These changes update only test selectors and do not alter application behavior.

## Browser results

The repository’s Chrome/CDP runner was executed against a uniquely named local PostgreSQL database after its selector contracts were updated. The final run passed:

- Protected-route gating and native required-field validation.
- Password visibility and login/registration mode transitions.
- Invalid credentials, login loading state and authentication error recovery.
- All three registration steps, required custom-dropdown values and password-mismatch recovery.
- Successful registration redirect and authenticated session persistence across reload.
- API fixture signup and browser login.
- Bank-account empty state and account creation.
- Invalid CSV import recovery, valid preview/confirmation and import history.
- Transaction loading, search and reconciliation-status filtering.
- Invoice-payment reconciliation, cancellation of reversal and confirmed reversal.
- Populated payroll payment-batch creation plus attempted and failed status transitions.
- Payroll automation setup, pause and resume.
- Statutory jurisdiction/rule configuration, preview and application.
- Employee/salary fixture creation and calculated payroll totals.
- Manual adjustment, submission, creator self-approval rejection and independent approval.
- Finalization, worker-generated payslip readiness and finance-viewer payslip access.
- Partial and final payroll payments with refreshed payment history.
- Finance-viewer restrictions for account, import, reconciliation and batch actions.
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

The runner now removes only the exact database it created after a successful run. It retains the database after a failed run, and `KEEP_BROWSER_TEST_DATABASE=1` explicitly retains a successful run for debugging. The lifecycle code validates the generated name against `puffinpal_browser_test_<timestamp>_<8 hex characters>` and refuses non-local PostgreSQL or port values before creating anything.

The latest passing authentication, Banking and invoice run removed its own database. The development database was not modified.

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
- Add isolated browser workflows for expenses, retainers, attendance, leave and employee management.
- Investigate the remaining suspected overlapping-request risks in `useExpenseCollection` and `useEmployeeDirectory.refresh`.
- Add accessibility automation for dialogs, dropdowns, date pickers, focus restoration and keyboard-only use.
- Configure repository-wide coverage with explicit inclusion of all `apps/web/src` files before adopting percentage thresholds.

## Browser-test isolation and database inventory

The browser runner starts the built API on `localhost:3002`, Next.js development server on `localhost:3003`, and a dedicated headless Chrome CDP endpoint on port `9223`. The database target was verified as the local `puffinpal-postgres` container running `postgres:16-alpine`, published only at `127.0.0.1:5433`. Each run replaces only the database pathname with a generated name, supplies a random test JWT secret and sets `NODE_ENV=test`. Test organizations, users and business records therefore live only in the generated database.

On 2026-10-30, the 19 previously documented candidates were revalidated individually for the local target, configured ownership and zero active connections. After explicit approval, those exact 19 databases were deleted without a wildcard or prefix-based deletion. A post-cleanup query confirmed every approved name was absent and the configured development database remained present.

Five databases from failed Banking-run diagnostics are currently retained. They use the same verified local owner and had zero active connections at the latest inventory:

```text
puffinpal_browser_test_1793369459935_40d77ee0
puffinpal_browser_test_1793369496144_d6ac2780
puffinpal_browser_test_1793369540018_7d8a5785
puffinpal_browser_test_1793369590787_542a7fb5
puffinpal_browser_test_1793369624562_b12e2404
```

They are intentionally retained for short-term debugging and were not covered by the earlier deletion approval.

Nine additional databases from failed Payroll-run diagnostics are retained under the same failure-preservation policy:

```text
puffinpal_browser_test_1793370174111_492e4e58
puffinpal_browser_test_1793370200592_460d6c4e
puffinpal_browser_test_1793370220773_09caf8c3
puffinpal_browser_test_1793370243349_728247e8
puffinpal_browser_test_1793370294095_6522c8f6
puffinpal_browser_test_1793370368468_fab7f1df
puffinpal_browser_test_1793370413687_e9cb7454
puffinpal_browser_test_1793370459546_49148932
puffinpal_browser_test_1793370565372_17f86c30
```

No cleanup approval applies to these databases, so the runner and this QA pass did not remove them.

## Confirmed regressions from browser expansion

The login submit button displayed `Creating workspace…` while an ordinary login request was pending. The shared busy branch did not distinguish login from registration. The button now displays `Logging in…` for login and preserves `Creating workspace…` for registration; the isolated browser workflow delays the login response deterministically and verifies the label and disabled fieldset before checking recovery from `Invalid credentials`.

Browser database isolation did not initially extend to Redis-backed authentication throttling. Repeated disposable runs shared the development prefix and eventually produced a false `Too many attempts` page. Each browser run now receives a unique validated `REDIS_RATE_LIMIT_PREFIX`; existing throttling rules and production configuration are unchanged.

Two Banking request races were reproduced deterministically:

| Hook                    | Reproduction                                                               | Resolution                                                                 |
| ----------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `useBankingRecords`     | Older aggregate load completed after refresh and replaced newer records    | Latest-generation guard covers data, errors, loading and unmount cleanup   |
| `useBankReconciliation` | Suggestions for transaction A completed after B and replaced B's candidates | Latest-open guard covers candidates/errors and invalidates when dialog closes |

Both regression tests failed before their fixes and pass afterward.

The Payroll selection hook had the same stale-response class: opening run A, then run B, allowed a slower A detail/workforce response to replace B. A deterministic regression now resolves B first and A last. A latest-open guard prevents obsolete data and errors from committing and invalidates in-flight selections on unmount.

## Authentication browser checkpoint

The first browser-expansion batch completed on 2026-10-30. Verification results:

- `pnpm exec turbo run check-types lint build`: 12/12 tasks successful; web and API lint, type checks and production builds passed.
- `cd apps/web && pnpm test`: 16/16 test files passed, representing all 78 declared cases; zero failures or skips.
- `cd apps/api && node scripts/test-invoice-browser.mjs`: authentication and invoice workflows passed; the successful run removed its newly created isolated database.
- `git diff --check`: passed.
- Feature/shared-to-route import-direction audit: passed.
- Static TypeScript/TSX import graph: 198 files inspected, zero circular dependencies found.

## Banking browser checkpoint

The Banking batch completed on 2026-10-30. The isolated Chrome workflow covers account creation, CSV validation and confirmation, search/status filtering, reconciliation and reversal, import history, empty payment-batch behavior and finance-viewer restrictions. A populated payroll payment batch was not invented and remains pending until its supported payroll prerequisites are exercised in the Payroll batch.

Banking checkpoint verification:

- `cd apps/web && pnpm test`: 16/16 files passed, representing all 80 declared cases; zero failures or skips.
- `pnpm exec turbo run check-types lint build`: 12/12 tasks successful with zero ESLint warnings.
- `cd apps/api && node scripts/test-invoice-browser.mjs`: authentication, Banking and invoice workflows passed; the successful database was removed automatically.
- `git diff --check`, import-direction audit and 198-file circular-dependency audit: passed.

## Payroll browser checkpoint

The Payroll batch completed on 2026-10-30. The isolated Chrome workflow now covers automation setup/pause/resume, statutory rule configuration/preview/application, deterministic salary calculation, an earning adjustment, submission, backend-enforced self-approval rejection, approval by a second administrator, finalization, worker-generated payslip completion, a populated Banking payment batch, partial/final payments and finance-viewer read-only boundaries.

The fixture uses a monthly USD salary with a base amount, taxable allowance and post-tax deduction. Assertions verify the calculated totals before statutory application, the withholding result after application and the final adjusted totals before payment. The successful database was removed automatically. Failed exploratory databases were retained as listed above.

Payroll checkpoint verification:

- `cd apps/web && pnpm test`: 16/16 files passed, representing all 81 declared cases; zero failures or skips.
- `cd apps/web && pnpm exec eslint --max-warnings 0`: passed with zero warnings.
- `cd apps/web && pnpm run check-types`: passed.
- `pnpm --filter @puffinpal/api build`: passed.
- `node apps/api/scripts/test-invoice-browser.mjs`: authentication, Payroll, Banking and invoice workflows passed; the successful database was removed automatically.

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
