# Onboarding tutorial

The guided tutorial is defined in `apps/web/features/onboarding/tour.ts` and rendered by
`product-tour.tsx`. Step definitions contain stable IDs, concise copy, an optional route and
spotlight target, and the backend permissions required to show the step.

The renderer filters steps from the authenticated session permissions, navigates between routes,
and looks up targets through `data-tour` attributes. Target lookup is bounded; a missing or hidden
target falls back to a centered tutorial card instead of blocking progress. Resize and scroll
events reposition visible spotlights. Arrow keys move between steps and Escape dismisses the tour.

First-time progress continues to use the existing onboarding API and per-user session-storage key.
Completed and skipped users are not restarted. Manual replay stores local progress without changing
their existing server completion state. Stable IDs allow newly added permission-specific steps to be
skipped safely when an older saved step no longer applies.

## Adding a step

1. Add a unique ID to `TOUR_STEPS` in the order it should appear.
2. Reuse a route already supported by workspace navigation.
3. Add a stable `data-tour` attribute to the smallest useful visible container.
4. Set `requiredPermissions` from `@puffinpal/permissions`; never infer access from a role name.
5. Keep copy short and describe only behavior that currently exists.
6. Add permission-filtering and navigation coverage to `apps/web/test/onboarding.test.mjs`.

Tutorial steps must remain observational. They must not submit forms, issue invoices, record
payments, upload files, or create disposable business records.
