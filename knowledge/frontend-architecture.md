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

| Feature implementation      | Baseline lines | Current lines | Extracted modules                                                     | Status                                                          |
| --------------------------- | -------------: | ------------: | --------------------------------------------------------------------- | --------------------------------------------------------------- |
| Banking page                |            920 |           300 | Record-loading/filter and reconciliation hooks plus existing panels   | Complete; page retains import, account and batch mutations      |
| Expenses page               |            836 |           287 | Collection hook, pagination/delete UI plus existing focused forms     | Complete; page retains CRUD, receipt and approval mutations     |
| Workforce page              |            728 |           297 | Calendar, management panel, holiday, schedule and settings components | Complete; page now coordinates state, API calls and actions     |
| Accounts Payable page       |            723 |           262 | Toolbar, filters, summary, bills table and three form dialogs         | Complete; page retains loading and mutation orchestration       |
| Payroll page                |            718 |           323 | Run history, creation, details, review and entries components         | Complete; page retains payroll workflow orchestration           |
| Cash Flow page              |            607 |           280 | Forecast controls, settings dialog, KPI, types and chart utilities    | Complete; page coordinates forecast loading and visualizations  |
| Workspace controller        |            574 |           382 | Content router, page header/actions and invoice-modal components      | Reviewed; cohesive session/API/navigation orchestration remains |
| Retainers page              |            525 |           162 | Schedule form, schedules table and generated-invoice history          | Complete; controller retains loading and recurring mutations    |
| Payroll statutory           |            471 |           221 | Configuration dialog, summary, preview controls and results table     | Complete; controller retains loading and statutory mutations    |
| Payroll automation          |            460 |           197 | Schedule dialog, overview, reminders, history and confirmation dialog | Complete; controller retains scheduling mutations               |
| Attendance page             |            450 |           450 | Existing workforce API/types/UI                                       | Pending table/form extraction                                   |
| Employee management dialogs |            446 |           446 | Existing employee services/types                                      | Pending dialog split                                            |
| Leave page                  |            436 |           441 | Existing workforce API/types/UI                                       | Pending table/form extraction                                   |
| Leave policy management     |            371 |           371 | Existing workforce API/types/UI                                       | Reviewed; policy forms remain candidates                        |
| Financial dashboard         |            370 |           307 | `types.ts`, `utils.ts`, `hooks/use-financial-summary.ts`              | Reviewed; chart sections remain candidates for extraction       |
| Employees page              |            337 |           337 | Existing employee service/types/directory/form modules                | Reviewed; orchestration remains                                 |
| Overtime page               |            307 |           307 | Existing workforce API/types/UI                                       | Reviewed; cohesive request workflow                             |
| Login page                  |            301 |           301 | Existing auth layout/registration components                          | Reviewed; cohesive authentication form                          |

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

Line counts are a navigation aid, not a quality metric. A file is complete only when its remaining responsibilities are cohesive. This inventory must be updated as the remaining controllers are decomposed.
