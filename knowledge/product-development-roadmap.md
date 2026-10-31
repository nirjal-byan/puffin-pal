# PuffinPal product completeness audit and roadmap

Audited: 2026-10-31

This document is a source-based product audit, not a test report. It compares the current web UI, API controllers and services, Prisma models, workers, permissions, and knowledge documents. No authoritative product roadmap existed before this audit; phase notes in `knowledge/` describe individual deliveries but are not a maintained statement of current product scope.

## Classification

- **Complete**: the primary workflow is connected end to end for its documented scope.
- **Mostly Complete**: the primary workflow works, with a bounded operational or UX gap.
- **Partial**: useful backend/UI capability exists, but an important workflow is absent or disconnected.
- **Placeholder**: visible surface exists without meaningful behavior.
- **Not Implemented**: no usable workflow exists.
- **Needs Product Decision**: implementation depends on choosing product scope or accounting/business rules.

## Executive summary

PuffinPal is well beyond a prototype. Its strongest complete paths are tenant-scoped RBAC, invoicing, recurring invoices, expense approval, fixed-salary payroll, attendance, leave, overtime, and the supporting job/file infrastructure. The largest product-completeness problem is not missing backend code: the Accounts Payable API already implements substantially more of the lifecycle than the UI exposes. The next largest risks are disconnected settlement/payment concepts, unsupported hourly and partial-period payroll, limited account recovery, and several older documents that contradict current code.

No verified P0 data-loss, authentication-bypass, tenant-isolation, or fundamentally broken core workflow was identified by this static audit. Runtime QA remains the authority for whether deployed workflows operate correctly.

## Current feature inventory

| Area | Feature | Classification | Evidence and boundary |
| --- | --- | --- | --- |
| Core platform | Organization signup, login, refresh, logout, profile, password change | Mostly Complete | Endpoints and UI are connected in `apps/api/src/modules/auth` and `apps/web/src/features/auth`; password recovery, email verification, device sessions, and per-device revocation are absent (`knowledge/authentication.md`). |
| Core platform | Multi-tenant scoping and RBAC | Complete | Request tenant context, default-deny permission guards, organization-scoped data access, and shared permissions are implemented in `apps/api/src/common`, `apps/api/src/modules/tenancy`, and `packages/permissions`. PostgreSQL RLS is not the chosen control; isolation is application-enforced. |
| Core platform | Team and role management | Mostly Complete | Member creation and role changes exist in `members.controller.ts` and `team-page.tsx`; ownership transfer, invitations/email delivery, member removal UI, and account deactivation are not complete product workflows. |
| Core platform | Organization/user settings, branding, onboarding, navigation | Mostly Complete | Profile, avatar/logo, currency, tutorial, and sectioned navigation are present. Access summary only describes a subset of permissions in `access-page.tsx`, and no organization ownership/closure workflow exists. |
| CRM | Client management | Complete | Tenant-scoped list/create/update/delete UI and API are connected; clients with invoices are protected from deletion. |
| Revenue | Invoice drafts, editing, issuance, PDF, payments, history | Mostly Complete | End-to-end in `apps/api/src/modules/invoices` and `apps/web/src/features/invoices`; invoice payment reversal/refund, credit notes, voiding issued invoices, and customer delivery are not modeled. |
| Revenue | Bulk invoice export | Complete | Durable BullMQ export, immutable PDFs, ZIP storage, expiry, retry, and download are implemented in `apps/api/src/infrastructure/background-jobs` and documented in `knowledge/background-jobs.md`. |
| Revenue | Recurring invoices / retainers | Mostly Complete | Schedule CRUD, pause/resume/cancel, worker occurrences, retry, generated invoices, and UI exist. Legacy `Retainer` records are not migrated into recurring schedules, and delivery/collection remain separate. |
| Spend | Expense capture, receipts, approval lifecycle | Mostly Complete | CRUD, receipt storage, submit/approve/reject/reopen, filters, and history are connected. The Expenses UI does not expose the existing expense-payment history, payment, or reversal endpoints in Accounts Payable. |
| Spend | Vendors and bills / Accounts Payable | Partial | The API supports vendor update/archive, bill update, attachments, submit/approve/reject/resubmit/void, payment history, bill/expense payment, and reversal in `accounts-payable.controller.ts`. `accounts-payable-page.tsx`, `vendor-grid.tsx`, and `bills-table.tsx` expose only create vendor, create a single-line bill, submit, approve, and record a bill payment. |
| Spend | AP aging and summary | Mostly Complete | Service/report aggregation exists, but the frontend fetches only the first 100 vendors/bills and then paginates locally; large organizations get incomplete search and totals at the view layer. |
| Banking | Bank accounts and CSV statement import | Mostly Complete | Account create/update API, preview/confirm import, dedupe, import history, and UI exist. The UI does not expose account edit/archive/default-account lifecycle; there is intentionally no live bank feed. |
| Banking | Reconciliation and reversal | Mostly Complete | Suggestions, one-to-one reconciliation, audit, and reversal are connected. Split/aggregate matching is unsupported, and list views cap retrieval at 100 records. |
| Banking | Payment batches | Partial | The batch is an auditable checklist, not money movement (`knowledge/banking-and-reconciliation.md`). Marking an item paid does not create a `PayrollPayment`, so payroll settlement and batch status can diverge unless the user records both. |
| Planning | Financial dashboard | Complete | Tenant-scoped period summaries and charts are connected in dashboard API/web modules. |
| Planning | Cash-flow forecasting | Mostly Complete | Deterministic scenarios, configuration, source toggles, event breakdown, and payroll/recurring inputs exist. Results are planning estimates, not bank balances; the view truncates event detail to 100 and assumptions around unpaid/paid expense timing need reconciliation with newer AP payment data. |
| Reporting | Operational financial reports and exports | Mostly Complete | Overview, revenue, expense, payroll, receivable, payable, cash movement, CSV, and PDF are implemented. This is intentionally not a ledger or GAAP/IFRS statement; multi-currency conversion, invoice payment reversals, and project reporting are absent. |
| People | Employees, departments, managers, salary history | Mostly Complete | CRUD, termination, departments, effective-dated structures, audit, and UI exist. Employee records cannot be rehired/reactivated through a documented workflow, and hourly structures cannot flow through payroll. |
| Workforce | Calendar, schedules, holidays, attendance, corrections | Mostly Complete | Manager/self attendance, calendars, schedules, holidays, summaries, and correction approval exist. Recurring holiday expansion is manual and advanced shift rostering/GPS/biometrics are outside current scope. |
| Workforce | Leave types, policies, balances, accrual, requests | Mostly Complete | Policy configuration, ledger-backed balances, adjustments, accrual execution, and request lifecycle are connected. Automatic accrual scheduling/carry-forward and automatic unpaid-leave payroll application are not end-to-end. |
| Workforce | Overtime requests and approval | Complete | Employee/manager creation, submit/approve/reject/cancel, rate/multiplier snapshot, duplicate prevention, and explicit payroll import exist. |
| Payroll | Fixed-salary pay runs | Complete | Draft, calculation, workforce review/import, adjustments, submit/reject/approve/finalize, concurrency, audit, and history are connected. “Complete” is limited to supported fixed-salary periods. |
| Payroll | Hourly and partial-period payroll | Not Implemented | Calculation rejects hourly structures and employees not covered for the full period because trusted-hour and proration policy rules have not been chosen (`knowledge/payroll-management.md`). |
| Payroll | Statutory calculations and reporting | Mostly Complete | Jurisdictions, effective rules, component classification, preview/apply snapshots, audit, and reports exist. Rates are configured by the organization; PuffinPal is not a maintained jurisdictional tax-content provider or filing service. |
| Payroll | Payslips and payment recording | Mostly Complete | Durable payslip generation/storage/retry/download and append-only payment recording exist. Payroll payment reversal/correction is not implemented. |
| Payroll | Automated scheduling and reminders | Mostly Complete | One schedule per organization, draft generation, idempotent occurrences, retry/history, and in-app notifications exist. Multiple employee groups/cadences, email, approaching-period reminders, and automatic overtime/leave application are deferred. |
| Infrastructure | Notifications | Partial | Persistent, read-state, deduplicated payroll notifications exist. There is no general notification center for approvals, invoices, expenses, AP, banking, or workforce events, and no email channel. |
| Infrastructure | File/PDF storage | Complete | Private S3-compatible receipt, bill attachment, invoice PDF, payslip, and export storage uses tenant-scoped keys and integrity checks. |
| Infrastructure | Background jobs | Complete | Separate BullMQ worker handles recurring invoices, payroll automation, payslips, invoice exports, retries, and cleanup; PostgreSQL remains the source of truth. |
| Infrastructure | Auditability | Mostly Complete | Domain audit/event tables exist for expenses, recurring schedules, employees, workforce, payroll, statutory, banking, AP, and cash-flow configuration. Audit visibility is fragmented and several histories are API-only. |
| Infrastructure | External integrations | Not Implemented / Needs Product Decision | There are no bank feeds, payment rails, payroll remittance, tax filing, accounting sync, transactional email, or exchange-rate providers. Their priority depends on target customer and compliance scope. |
| Operations | Containerized deployment | Mostly Complete | Production Compose, Caddy, health/readiness, separate worker, and deployment guidance exist. Cloud provisioning, managed-secret integration, centralized telemetry/alerting, and proven automated restore drills are not productized. |

No user-facing feature was classified as **Placeholder**: incomplete areas generally have real persisted behavior, but expose only part of the intended workflow.

## Workflow audit and concrete gaps

### 1. Revenue lifecycle

`Client -> Draft invoice -> Issue -> Immutable PDF -> Record payment -> Paid/overdue reporting` is connected. Recurring schedules generate invoices through a durable worker and retain occurrence history.

Gaps:

- A wrongly recorded invoice payment has no append-only reversal/refund path (`invoices.controller.ts` only creates payments).
- Issuance does not deliver an invoice to the client; users must download and send the PDF outside PuffinPal.
- There is no credit-note or issued-invoice void workflow, so corrections after issuance require a product/accounting decision.

### 2. Expense-to-cash lifecycle

`Expense -> Receipt -> Submit -> Approve` is complete. The newer AP service can settle an expense and reverse that settlement, and reporting can use payable payment evidence.

Gap: `expenses-page.tsx` ends at approval and never calls `GET/POST /expenses/:id/payments` or `POST /expense-payments/:id/reverse`. A finance user cannot finish the expense lifecycle from the expense screen.

### 3. Vendor bill lifecycle

The backend lifecycle is `Vendor -> Bill draft -> Attachment/update -> Submit -> Approve/reject -> Resubmit/void -> Pay -> Reverse payment -> Aging/reporting`.

The current UI lifecycle is only `Create minimal vendor -> Create one-line bill -> Submit -> Approve -> Pay`. The discrepancy is the highest-value existing-code gap: users cannot edit/archive vendors, make multi-line bill changes, manage attachments, reject/resubmit/void, view payment history, or reverse payments even though API contracts already exist.

### 4. Banking and settlement

`Create account -> Preview/import CSV -> Match to a recorded payment -> Reconcile/reverse` is connected and appropriately avoids treating imported rows as duplicate cash events.

Gaps:

- Payment batch “paid” state and `PayrollPayment` are separate records. The product must either atomically record/reference the payroll payment or clearly keep the batch as export/checklist-only.
- One-to-one matching cannot represent one bank transaction covering several obligations or a split transaction.
- Account maintenance is API-capable but not fully exposed in the UI.

### 5. Workforce-to-payroll lifecycle

`Employee + fixed salary -> Attendance/leave/overtime review -> Explicit imports/adjustments -> Calculate -> Submit -> Approve -> Finalize -> Payslip/payment` is connected. Explicit imports avoid silently changing payroll.

Gaps:

- Hourly structures and mid-period hires/terminations cannot be calculated.
- Approved unpaid leave and overtime are deliberately manual imports; automation creates a draft but does not apply them.
- An attendance correction after finalized payroll can flag payroll impact, but no adjustment queue automatically carries that difference into the next run.
- Payroll payment reversal has no append-only correction workflow.

### 6. Reporting and planning

Dashboard, forecast, operational reporting, receivables, payables, and exports are usable and based on persisted source records.

Boundaries requiring explicit positioning:

- Reports are operational, not a general ledger or statutory P&L.
- Currency totals are isolated; no conversion is performed.
- Project profitability is impossible because projects are not modeled/linked.
- Forecast assumptions should be reviewed against actual expense/AP settlement dates now that `PayablePayment` exists.

## UX, integration, and product debt

| Finding | Impact | Evidence |
| --- | --- | --- |
| AP frontend exposes a small subset of its API | Users cannot complete exception and correction paths | `accounts-payable.controller.ts` versus `accounts-payable-page.tsx`, `bills-table.tsx`, and `vendor-grid.tsx` |
| Native prompts/confirms remain in finance-sensitive actions | Weak validation, accessibility, consistency, and review context | Payroll page, AP page, banking page, and reconciliation hook use `window.prompt`/`window.confirm` |
| Several feature loaders fetch exactly 100 records | Incomplete options/results at scale, hidden rather than signaled | AP, banking, recurring invoices, employees, workforce, and payroll feature loaders |
| Audit history is fragmented | Operators cannot answer “who changed what?” without API/database access | Multiple audit models/controllers; no cross-domain audit UI |
| Access page lists only clients/invoices/expenses/retainers | Users receive an incomplete permission explanation | `apps/web/src/features/settings/components/access-page.tsx` |
| Team provisioning shares an initial password manually | Operational security and onboarding burden | `team-page.tsx`; no invitation/email workflow |
| In-app notifications cover payroll automation only | Approvals and exceptions can be missed | `PayrollNotification` and payroll notification controller/provider |
| Legacy `Retainer` and current recurring schedules coexist | Ambiguous ownership/migration for old records | `Retainer` plus `RecurringInvoiceSchedule` models; `knowledge/recurring-invoices.md` |
| Knowledge documents contain superseded claims | Misleads deployers and future development | `authentication.md` says issuance is absent; `payroll-management.md` says statutory/overtime/automation are absent; `financial-reporting.md` both documents and denies AP integration |
| Operational controls are documented, not automated as a platform | Production readiness depends on operator discipline | `compose.production.yml`, `knowledge/docker-deployment.md`, no cloud/IaC/telemetry module |

## Product decisions required

1. **Accounting boundary:** remain an operational finance workspace, or add a general ledger, journal entries, close periods, credit notes, and statutory statements.
2. **Payment boundary:** remain record/reconcile-only, or integrate bank feeds and payment initiation. This decides payment-batch behavior and compliance obligations.
3. **Payroll coverage:** define hourly time source, partial-period proration, retroactive adjustments, and payment reversal rules before implementation.
4. **Compliance responsibility:** organization-managed statutory rules versus maintained country packs, filing, and remittance.
5. **Multi-currency:** isolated currency views versus base-currency conversion, exchange-rate sources, and realized/unrealized gains.
6. **Workforce depth:** lightweight attendance/calendar versus shift rostering, recurrence expansion, location, GPS, and biometrics.
7. **Communications:** in-app-only versus transactional email for invitations, invoices, reminders, approvals, and failed automation.

## Prioritized roadmap

### P0 — blocks safe core operation

No P0 was proven by static inspection. Any runtime finding involving tenant leakage, authorization bypass, incorrect financial mutation, failed migrations, or destructive concurrency must supersede this roadmap immediately.

### P1 — highest customer and operational value

| Work item | User/business value | Dependencies | Size |
| --- | --- | --- | --- |
| Complete the Accounts Payable frontend against existing endpoints | Makes vendor/bill correction, approval exceptions, attachments, and payment audit usable without backend workarounds | Existing API; focused browser regression | Large |
| Add expense settlement history, pay, and reversal UI | Completes approved-expense lifecycle and improves cash evidence | Existing AP expense-payment endpoints; permissions | Medium |
| Resolve payment-batch/payroll-payment semantics | Prevents two “paid” states from diverging | Product decision on checklist vs atomic payment recording | Medium |
| Add append-only invoice and payroll payment reversal workflows | Corrects operator mistakes without deleting audit history | Accounting rules, permissions, reporting updates | Large |
| Implement secure invitation, account recovery, and email verification | Removes password sharing and avoids unrecoverable accounts | Email provider, token lifecycle, abuse controls | Large |
| Define and implement hourly/partial-period payroll | Expands payroll beyond fixed full periods | Trusted hours, proration, leave/overtime and statutory rules | Very Large |

### P2 — quality, scale, and completeness

| Work item | Value | Dependencies | Size |
| --- | --- | --- | --- |
| Replace first-100 loaders with server pagination/search | Prevents silent incompleteness as organizations grow | Existing page DTOs; some API filters | Medium |
| Replace native prompts/confirms with shared reviewed dialogs | Consistent, accessible, validated finance actions | Shared form/modal components | Medium |
| Expose bank account maintenance and audit history | Completes existing banking API capability | Existing update/audit endpoints | Small–Medium |
| Build a unified audit activity view | Improves support, controls, and operator accountability | Normalize event presentation and permissions | Large |
| Expand notification center to approvals/failures/due work | Reduces missed operational work | Notification event taxonomy; optional email decision | Large |
| Carry finalized-period workforce corrections into next payroll | Makes payroll-impact flags actionable | Retroactive adjustment policy | Large |
| Reconcile cash-flow assumptions with payable settlements | Improves forecast timing accuracy | Review forecast queries and AP payment recognition | Medium |
| Add recurring holiday expansion and automated leave accrual scheduling | Reduces recurring manual workforce operations | Timezone/idempotency rules and worker job | Medium |
| Reconcile stale documentation with current code | Prevents false gap reports and unsafe operator assumptions | None | Small |
| Add observability and restore evidence | Improves production operability | Hosting choice, metrics/log/alert provider, backup target | Large |

### P3 — expansion after positioning decisions

| Work item | Dependency / reason to defer | Size |
| --- | --- | --- |
| Live bank feeds, payment initiation, split/aggregate matching | Provider, security, compliance, and payment-boundary decision | Very Large |
| General ledger and standards-based financial statements | Accounting-boundary decision and substantial new domain model | Very Large |
| Exchange-rate conversion and FX accounting | Base-currency and accounting-policy decision | Very Large |
| Country-maintained tax packs, filing, and remittance | Jurisdiction/legal ownership and provider strategy | Very Large |
| Advanced shift rostering, GPS, and biometrics | Workforce product positioning and privacy requirements | Very Large |
| Project profitability and time billing | New project/time domain and links to invoices/payroll | Large |

## Immediate next task

**Complete the Accounts Payable frontend using the already implemented API.** This is the best next task because it closes the largest verified UI/backend gap, unlocks existing safe server behavior, and does not require a schema or API redesign.

Completion criteria:

1. Vendors can be viewed, edited, archived/restored as allowed, with full supported fields and concurrency/error handling.
2. Bills can be viewed and edited with multiple items, discounts, attachment upload/download/removal, and version checks.
3. All valid transitions are exposed: submit, approve, reject with reason, resubmit, and void with reason.
4. Bill payment history is visible; authorized users can record and append-only reverse payments with idempotency-safe retry behavior.
5. Expense settlement remains a separate follow-up or is explicitly included with the same payment-history pattern.
6. Lists use server-backed pagination/search rather than first-100 client slicing.
7. Permissions hide or disable unauthorized actions; tenant IDs are never client-selectable.
8. Focused API, component, and browser tests cover happy paths, invalid transitions, stale versions, duplicate/lost-response safety, and another-tenant IDs.
9. Existing reports and aging totals are verified after bill payment and reversal.

## Recommended delivery sequence

1. AP frontend completeness.
2. Expense settlement UI.
3. Payment-batch semantics and payment reversals.
4. Auth invitation/recovery.
5. Pagination, audit visibility, and dialog consistency.
6. Decide hourly/proration and broader accounting/payment scope before starting those large programs.

This sequence favors completing already-modeled workflows before adding new domains or external integrations.
