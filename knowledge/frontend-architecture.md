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

| Feature implementation      | Baseline lines | Current lines | Extracted modules                                         | Status                                                      |
| --------------------------- | -------------: | ------------: | --------------------------------------------------------- | ----------------------------------------------------------- |
| Banking page                |            920 |           829 | `types.ts`, `constants.ts`, `bank-account-grid.tsx`       | Partial; transaction/import/batch tables and dialogs remain |
| Expenses page               |            836 |           710 | `expense-form.tsx` (existing schemas/utils retained)      | Partial; filters, workflow dialogs and list remain          |
| Workforce page              |            728 |           728 | Existing `types.ts`, `api.ts`, `workforce-ui.tsx`         | Pending further decomposition                               |
| Accounts Payable page       |            723 |           645 | `types.ts`, `constants.ts`, `utils.ts`, `vendor-grid.tsx` | Partial; bills table and three dialogs remain               |
| Payroll page                |            718 |           718 | Existing automation/statutory components                  | Pending further decomposition                               |
| Cash Flow page              |            607 |           540 | `types.ts`, `utils.ts`, `cash-flow-kpi.tsx`               | Partial; charts/events/settings dialog remain               |
| Workspace controller        |            574 |           574 | Existing layout/dashboard entry components                | Pending controller/hook extraction                          |
| Retainers page              |            525 |           525 | Existing API/types modules                                | Pending form/list extraction                                |
| Payroll statutory           |            471 |           471 | Existing payroll domain ownership                         | Pending form extraction                                     |
| Payroll automation          |            460 |           460 | Existing payroll domain ownership                         | Pending dialog extraction                                   |
| Attendance page             |            450 |           450 | Existing workforce API/types/UI                           | Pending table/form extraction                               |
| Employee management dialogs |            446 |           446 | Existing employee services/types                          | Pending dialog split                                        |
| Leave page                  |            436 |           436 | Existing workforce API/types/UI                           | Pending table/form extraction                               |

Line counts are a navigation aid, not a quality metric. A file is complete only when its remaining responsibilities are cohesive. This inventory must be updated as the remaining controllers are decomposed.
