# Frontend architecture

PuffinPal's web application uses the Next.js App Router with thin route entry points and domain-oriented feature modules. This document describes the structure that exists in the repository; it does not prescribe empty placeholder directories.

## Current structure

```text
apps/web/src/
├── app/
│   ├── (auth)/                 # Public authentication routes and shell
│   ├── (dashboard)/            # Authenticated route entries and layout
│   ├── error.tsx
│   ├── layout.tsx
│   └── not-found.tsx
├── components/
│   ├── layout/                 # Navbar, sidebar, brand, theme, notifications
│   ├── shared/                 # Cross-domain page and settings components
│   └── ui/                     # Low-level modal, field, picker and status primitives
├── features/
│   ├── accounts-payable/       # Payables page, models, constants and filtering
│   ├── banking/                # Banking page, models, constants and account cards
│   ├── cash-flow/              # Forecast page, models and display transformations
│   ├── expenses/               # Expense page, form, validation and date/money helpers
│   ├── invoices/               # API, schemas, hooks, models and focused components
│   └── ...                     # Other business domains follow the same ownership rule
├── lib/                        # App-wide API and navigation infrastructure
└── providers/                  # Root-level React providers
```

## Ownership rules

### Route entries

Files in `app/` define URLs, layouts, metadata and server/client boundaries. They should compose feature components and should not contain domain workflows. Existing route entry files are 4–6 lines, apart from the 33-line root layout.

Use a route-private `_components/`, `_hooks/` or `_utils/` directory only when code belongs to that route and is not part of a reusable business domain. Do not duplicate a feature implementation inside a route-private folder.

### Features

Code belongs in `features/<domain>/` when it expresses a business concept or is reused by multiple views in that domain. Keep domain models in `types.ts`, stable configuration in `constants.ts`, pure transformations in `utils.ts`, API wrappers in `services/` or `api/`, and React UI in `components/` (or focused root files for small domains).

Examples:

- `features/banking/types.ts` owns bank-account, transaction, import and reconciliation models.
- `features/accounts-payable/utils.ts` owns pure vendor/bill filtering and sorting.
- `features/cash-flow/utils.ts` owns chart transformations and source labels.
- `features/expenses/components/expense-form.tsx` owns expense form presentation.

### Shared components

Move a component to `components/shared/` only when two or more domains need the same stable concept. Low-level interaction primitives belong in `components/ui/`; application chrome belongs in `components/layout/`.

Prefer composing the existing `FormModal`, `FormField`, `Dropdown`, `DatePicker`, `StatusBadge`, `PageHeader`, and notification primitives. Do not create domain-neutral components with dozens of conditional props.

## Hooks and data access

- Keep the authenticated API client in `lib/api.ts`.
- Domain API functions should live with their feature when they are reusable or complex.
- Extract a custom hook when it owns a coherent lifecycle such as loading, mutation and refresh. Do not create a hook that merely hides unrelated `useState` calls.
- Abort in-flight requests where the existing behavior does so.
- Never cache tenant-scoped responses outside the authenticated organization context.

## Forms and dialogs

- Presentation belongs in a focused form/dialog component.
- Pure validation belongs in a schema module, as demonstrated by `features/expenses/schemas/expense.schema.ts`.
- Payload construction and API mutation remain in the owning feature controller or service hook.
- Use the shared modal and field primitives to preserve focus, keyboard behavior and consistent alignment.

## Server and Client Components

Route and layout components are Server Components unless browser state or event handling is required. Keep `"use client"` on the narrowest interactive feature boundary. The root layout owns fonts, global styles, metadata and root providers.

## Imports and naming

- Use `@/` aliases for cross-tree imports.
- Use relative imports for files in the same feature.
- Name files after their responsibility (`vendor-grid.tsx`, not `components.tsx`).
- Avoid catch-all `helpers.ts`; use a domain-specific `utils.ts` only for small, related pure functions.
- Import types with `import type`.

## Adding a page

1. Add a small route entry under the appropriate App Router group.
2. Reuse an existing feature component or create a domain under `features/`.
3. Keep URL/metadata concerns in the route and workflows in the feature.
4. Reuse layout and UI primitives.
5. Add permission checks at the existing authenticated boundary and in permission-sensitive actions.
6. Add focused tests, then run typecheck, lint, tests and the production build.

## Adding a feature

Start with the smallest real structure. Add `types.ts`, `constants.ts`, `utils.ts`, `components/`, `hooks/`, `services/` or `schemas/` only when the feature actually needs them. Do not create empty directories. Keep backend-authoritative financial calculations on the backend; frontend utilities may format or transform returned results for display.

## Refactoring inventory

The route files were already thin before this audit. The remaining work is concentrated in client-side feature controllers.

| Feature implementation      | Baseline lines | Current lines | Extracted modules                                                     | Status                                                         |
| --------------------------- | -------------: | ------------: | --------------------------------------------------------------------- | -------------------------------------------------------------- |
| Banking page                |            920 |           300 | Record-loading/filter and reconciliation hooks plus existing panels   | Complete; page retains import, account and batch mutations     |
| Expenses page               |            836 |           287 | Collection hook, pagination/delete UI plus existing focused forms     | Complete; page retains CRUD, receipt and approval mutations    |
| Workforce page              |            728 |           297 | Calendar, management panel, holiday, schedule and settings components | Complete; page now coordinates state, API calls and actions    |
| Accounts Payable page       |            723 |           262 | Toolbar, filters, summary, bills table and three form dialogs         | Complete; page retains loading and mutation orchestration      |
| Payroll page                |            718 |           287 | Existing components plus run-loading and selection hook               | Complete; page retains payroll workflow mutations              |
| Cash Flow page              |            607 |           280 | Forecast controls, settings dialog, KPI, types and chart utilities    | Complete; page coordinates forecast loading and visualizations |
| Workspace controller        |            574 |           281 | Existing components plus record-loading and theme hooks               | Complete; controller retains auth, navigation and composition  |
| Retainers page              |            525 |           162 | Schedule form, schedules table and generated-invoice history          | Complete; controller retains loading and recurring mutations   |
| Payroll statutory           |            471 |           221 | Configuration dialog, summary, preview controls and results table     | Complete; controller retains loading and statutory mutations   |
| Payroll automation          |            460 |           197 | Schedule dialog, overview, reminders, history and confirmation dialog | Complete; controller retains scheduling mutations              |
| Attendance page             |            450 |           241 | Records/review tables and record/correction dialogs                   | Complete; controller retains server-timed mutations            |
| Employee management dialogs |            446 |             — | Department, confirmation, details and salary dialogs                  | Complete; obsolete compatibility barrel removed                |
| Leave page                  |            436 |           208 | Request/type dialogs, balances and request-history components         | Complete; controller retains versioned leave mutations         |
| Leave policy management     |            371 |           156 | Policy table, policy form and balance-adjustment dialog               | Complete; controller retains accrual and ledger mutations      |
| Financial dashboard         |            370 |           244 | Existing modules plus reporting-period filter                         | Complete; page retains financial transformations and charts    |
| Employees page              |            337 |           254 | Directory lifecycle hook and page-dialog coordinator                  | Complete; page retains employee and salary mutations           |
| Overtime page               |            307 |           158 | Request-history table and overtime-request dialog                     | Complete; controller retains submission and review workflow    |
| Login page                  |            301 |           259 | Existing auth modules plus sign-in credential fields                  | Complete; page retains authentication and registration flow    |

Phase 2 pure-utility coverage includes payables filtering/sorting, cash-flow chart conversion, dashboard date ranges/labels, payroll period defaults, workforce calendar ranges and recurring-invoice cadence labels. Phase 3 completed the Workforce presentation boundary: the controller retains orchestration while calendar rendering, its management rail and each modal form own their JSX independently.

Phase 3B applies the same boundary to Payroll and Banking. Payroll mutations and optimistic-version handling remain in `payroll-page.tsx`, while run history, draft creation, run details, workforce review and entry actions render in focused components. Banking loading, filtering and mutations remain in `banking-page.tsx`, while its toolbar, account/transaction/import/batch views and account/import/reconciliation/payment-batch dialogs own presentation. No API contracts or financial calculations moved.

Phase 3C decomposes Expenses and Accounts Payable. Expense filters, permission-aware table actions, details/history and workflow confirmation are feature components around the existing validated expense form. Payables now separates its toolbar, filters, aging summary, bills table, vendor form, bill form and payment form. The controllers continue to own API mutations, optimistic versions, idempotency keys and success/error coordination.

Phase 4 begins with the Workspace boundary. Cross-feature page selection now lives in `workspace-content.tsx`, page heading/actions in `workspace-page-header.tsx`, and create/edit invoice overlays in `workspace-invoice-modals.tsx`. The remaining controller coordinates session-bound API access, URL navigation, notifications, legacy pagination and application chrome. It remains above 300 lines because those concerns share the same authenticated workspace lifecycle; further reduction should extract coherent state hooks rather than move the controller wholesale.

The initial Phase 4 Workspace checkpoint passed the web typecheck, lint suite, unit tests and production build. At that boundary, sixteen TypeScript/TSX files remained above 300 lines. The architecture cleanup remains in progress.

The Phase 4 continuation completes the payroll settings batch. Statutory configuration and preview presentation now sit beside a 221-line orchestration controller. Automation schedule editing, status/reminder presentation, history and draft confirmation now sit beside a 197-line controller. All extracted payroll components remain below 200 lines. Fourteen TypeScript/TSX files remain above 300 lines; Banking and Expenses are the next priority batch.

The final-overhaul Batch A completes Banking and Expenses. `useBankingRecords` owns the parallel record lifecycle and transaction filtering, while `useBankReconciliation` owns candidate loading, matching and reversal. `useExpenseCollection` owns applied filters, pagination and query loading; delete confirmation and pagination presentation are focused components. The controllers remain responsible for their distinct mutations, preserving request order and optimistic-concurrency payloads.

Batch A passes the full frontend typecheck, ESLint, all 12 frontend tests, the production build, `git diff --check`, and the feature-to-route import-direction audit. Twelve TypeScript/TSX files remain above 300 lines. Browser regression testing was not available for this checkpoint; banking import/reconciliation and expense CRUD, receipt and approval workflows still require manual verification.

Batch B begins with Cash Flow. Scenario and horizon controls now belong to `forecast-controls.tsx`, while the complete settings form and configuration mutation belong to `cash-flow-settings-dialog.tsx`. The 280-line page retains abortable forecast loading, currency formatting and chart/event composition. Retainers remains the next unstarted feature boundary.

Batch B continues with Retainers. The schedule form owns cadence, client, date, payment-term, line-item and auto-issue presentation; the schedules table owns status-aware row actions and empty state; generated-invoice history owns invoice links and retry actions. The 162-line controller retains workspace/detail loading, optimistic versions, mutations, notifications and request ordering. No additional hook was warranted for this compact orchestration layer.

The completed Retainers continuation passes the full frontend typecheck, ESLint, all 12 frontend tests, the production build, `git diff --check`, and the feature-to-route import-direction audit. Ten TypeScript/TSX files remain above 300 lines. Browser regression testing remains pending for schedule creation/editing, status transitions, occurrence retry and invoice links.

Batch C begins with Attendance. Attendance history and pending-correction review now own their table presentation, while daily-record and correction-request dialogs own their form UI. The 241-line controller retains parallel loading, server-authoritative check-in/out, manager recording, correction mutations and refresh ordering. Leave, policy management and Overtime remain unstarted in this batch.

This Attendance checkpoint passes the frontend typecheck, ESLint, all 12 frontend tests, the production build, `git diff --check`, and the import-direction audit. Nine TypeScript/TSX files remain above 300 lines. Browser verification remains pending for check-in/out, manager recording and correction request/review workflows.

Batch C continues with Leave. Balance summaries and request history now own their presentation, while request and leave-type dialogs own their complete form UI. The 208-line controller retains parallel loading, the create-then-submit sequence, permission-sensitive endpoints, optimistic versions, review mutations and refresh ordering. Leave Policy Management and Overtime remain the next unstarted feature boundaries.

The Leave checkpoint passes the frontend typecheck, ESLint, all 12 frontend tests, the production build, `git diff --check`, and the feature-to-route import-direction audit. Eight TypeScript/TSX files remain above 300 lines. Browser verification remains pending for leave creation/submission, approval/rejection and leave-type creation.

Batch C completes with Leave Policies and Overtime. Policy listing, creation and ledger adjustment now render independently of the 156-line controller, which retains effective-date accrual preview/run requests, exact minute conversion and idempotent ledger mutations. Overtime history and request presentation now sit beside a 158-line controller that retains permission-sensitive create/submit ordering, optional compensation payload handling, optimistic versions and approval/rejection mutations. No hook was warranted for either compact lifecycle.

The completed Batch C passes the frontend typecheck, ESLint, all 12 frontend tests, the production build, `git diff --check`, and the feature-to-route import-direction audit. Six TypeScript/TSX files remain above 300 lines. Browser verification remains pending for accrual preview/run, ledger adjustments and overtime request/review workflows. Batch D proceeds with Employee Management Dialogs, Employees and Workspace.

Batch D splits the former employee-dialog collection into department management, confirmation, employee details and salary-structure forms; the four-line original module remains as a stable compatibility barrel. `useEmployeeDirectory` owns employee workspace loading, filtering and refresh while the page-level dialog coordinator owns overlay selection. The 254-line Employees controller retains employee, salary, department and termination mutations with their original request ordering and optimistic versions.

Workspace record loading, abort handling, tab resets and legacy pagination now belong to `useWorkspaceRecords`; persisted theme selection and view-transition cleanup belong to `useWorkspaceTheme`. The 281-line controller continues to own session-bound API creation, authorization, navigation, access refresh, notifications and composition of the existing content, header and invoice-modal components.

The completed Batch D passes the frontend typecheck, ESLint, all 12 frontend tests, the production build, `git diff --check`, and the feature-to-route import-direction audit. Three TypeScript/TSX files remain above 300 lines: Payroll, Financial Dashboard and Login. Browser verification remains pending for employee CRUD, salary creation, department mutations, termination, workspace pagination, navigation and theme transitions. Batch E is the next planned phase.

Batch E finishes feature-level size remediation. `usePayrollRuns` owns run collection loading and selected-run detail/workforce-review loading; the 287-line Payroll controller retains every calculation, import, approval, finalization, adjustment, payment and payslip mutation. The dashboard reporting-period control is a focused component beside the existing summary hook, leaving all server-provided financial values and chart transformations in the 244-line dashboard. Login credential fields are isolated as static presentation while the 259-line page retains validation, registration steps, credential submission, session handoff and card animation.

The completed Batch E passes the frontend typecheck, ESLint, all 12 frontend tests, the production build, `git diff --check`, and the feature-to-route import-direction audit. No TypeScript or TSX file under `apps/web/src` exceeds 300 lines. Browser verification remains pending for payroll run selection and mutations, dashboard preset/custom ranges, login, registration and authentication transitions. The repository-wide final architecture audit is documented below.

## Final structural refinement

Feature folders use only the layers they need:

- `components/` owns page controllers, tables, cards, filters and other feature presentation.
- `dialogs/` is used when a feature has several modal workflows, as in Accounts Payable, Banking, Employees, Payroll and Workforce.
- `hooks/` owns focused stateful lifecycles.
- `services/` or `api/` owns reusable endpoint wrappers.
- A cohesive `types.ts`, `constants.ts` or `utils.ts` stays at the feature root; directories are used only when multiple modules justify them.
- Routes compose feature controllers and do not import feature implementation back into `app/`.

Representative Accounts Payable structure:

```text
features/accounts-payable/
├── components/
│   ├── accounts-payable-page.tsx
│   ├── bills-table.tsx
│   ├── payables-filters.tsx
│   ├── payables-summary.tsx
│   ├── payables-toolbar.tsx
│   └── vendor-grid.tsx
├── dialogs/
│   ├── bill-dialog.tsx
│   ├── vendor-dialog.tsx
│   └── vendor-payment-dialog.tsx
├── constants.ts
├── types.ts
└── utils.ts
```

Banking follows the same presentation/dialog split and additionally owns `hooks/use-banking-records.ts` and `hooks/use-bank-reconciliation.ts`. Employees, Payroll and Workforce now separate their multiple modal workflows into `dialogs/`. Recurring Invoices and Workforce place reusable endpoint wrappers in `services/`. Dashboard and Onboarding presentation lives in `components/`.

### Import and dependency rules

- Same-feature imports are relative; aliases are reserved for cross-tree or cross-feature imports.
- Workspace is the intentional composition root and directly imports feature controllers.
- Workspace also intentionally composes Invoice and Onboarding UI.
- Shared UI, layout, providers and `lib/` do not import route pages or feature internals.
- Compatibility barrels are retained only when they serve an external/stable entry point. The unused employee-dialog barrel was removed.

### Final audit findings

| Finding                                                                                  | Resolution                                                                   |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Accounts Payable and Banking mixed controllers, tables, hooks and dialogs at their roots | Moved presentation, dialogs and hooks to responsibility-specific directories |
| Employee, Payroll and Workforce modal workflows were mixed with ordinary presentation    | Moved modal workflows into feature-owned `dialogs/` directories              |
| Dashboard and Onboarding UI lived at feature roots                                       | Moved into their existing/new `components/` directories                      |
| Recurring Invoice and Workforce API wrappers lived beside presentation                   | Moved into feature-owned `services/` directories                             |
| Employee dialog compatibility barrel had one internal consumer                           | Replaced with direct dialog imports and removed the barrel                   |
| Two identical layout wrappers had no static, dynamic, route or test consumers            | Removed `expenses-layout.tsx` and `retainers-layout.tsx`                     |
| Same-feature aliases bypassed local ownership                                            | Replaced with relative imports                                               |

The static import graph reports no cycles and no feature-to-route reverse imports. TypeScript with `noUnusedLocals` and `noUnusedParameters` reports no unused local declarations. A zero-inbound static-file audit found only the two deleted layout wrappers. Dedicated Madge/unused-export tooling is not installed, so the audit relies on the TypeScript compiler, ESLint, repository search and the static import graph rather than claiming third-party analyzer coverage.

No TypeScript or TSX file under `apps/web/src` exceeds 300 lines. No routes, dependencies, API contracts, calculations or runtime workflows changed during the structural refinement.

### Manual browser regression checklist

- Authentication: login, invalid credentials, registration steps, session persistence, redirects and card animations.
- Finance: bank account/import/reconciliation, expense CRUD and approvals, vendor/bill/payment workflows, cash-flow settings, dashboard ranges, reporting exports and retainer lifecycle/history.
- Workforce: attendance record/correction, leave request/review, accrual preview/run, balance adjustment, overtime request/review and employee/department/salary/termination workflows.
- Payroll: draft generation, workforce imports, calculation, submit/approve/reject/finalize, adjustments, partial/full payments and payslip download/retry.
- Workspace: top/side navigation, legacy pagination, notifications, theme persistence/transitions and invoice create/edit/detail dialogs.

Automated checks validate compilation, lint rules, unit tests, production bundling and static architecture. The browser checklist remains required before production regression sign-off.

Line counts are a navigation aid, not a quality metric. A file is complete only when its remaining responsibilities are cohesive. Keep this inventory current as features evolve.
