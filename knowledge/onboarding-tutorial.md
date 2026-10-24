# Onboarding tutorial

The guided tutorial is defined in `apps/web/features/onboarding/tour.ts` and rendered by
`product-tour.tsx`. It is deliberately capped at nine permission-filtered steps: welcome,
overview, billing, spending, cash flow, people, payroll, payroll automation, and finish.

Each feature gets one short page-level explanation. The tour covers recurring billing, workforce
management, cash-flow forecasting, payroll, automation, reminders, and statutory rules without
asking the user to create sample records.

The renderer filters steps from the authenticated session permissions, navigates between routes,
and looks up targets through `data-tour` attributes. Target lookup is bounded; a missing or hidden
target falls back to a centered tutorial card instead of blocking progress. Resize and scroll
events reposition visible spotlights. Arrow keys move between steps and Escape dismisses the tour.

First-time progress uses the existing onboarding API and per-user session-storage key.
Completed and skipped users are not restarted. Manual replay stores local progress without changing
their existing server completion state. Legacy detailed step IDs map to their new concise section,
so saved tours continue after this reduction.

## Adding a step

1. Add a unique ID to `TOUR_STEPS` in the order it should appear.
2. Reuse a route already supported by workspace navigation.
3. Add a stable `data-tour` attribute to the smallest useful visible container.
4. Set `requiredPermissions` from `@puffinpal/permissions`; never infer access from a role name.
5. Keep copy short and describe only behavior that currently exists.
6. Add permission-filtering and navigation coverage to `apps/web/test/onboarding.test.mjs`.

Tutorial steps must remain observational. They must not submit forms, issue invoices, record
payments, upload files, or create disposable business records.
