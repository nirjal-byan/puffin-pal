# Invoice creation UI and feature organization

Start the services and apps with `make services.start` and `make run`.
Open http://localhost:3000/invoices/new, or choose Invoices → Create Invoice.
The new http://localhost:3000/invoices route renders the existing dashboard invoice list.
Both routes reuse the same session boundary, refresh-cookie handling and permission policy.

## Workflow

Select a client, set issue/due dates, optionally add notes, and edit 1–100 line items.
Client search matches names, company names and email addresses among loaded clients.
The selector initially loads 100 clients; Load more clients fetches the next page.
The empty state links to the existing client screen at `/?section=clients`.

Quantities are positive integers and prices are decimal strings with at most two
fractional digits. Line amounts and totals use BigInt cents, matching the backend.
Amounts are presented without a currency symbol. No currency, tax or discount input
is introduced. The backend remains authoritative.

Save as Draft calls the existing authenticated client with only `clientId`, `issueDate`,
`dueDate`, optional `notes`, and items containing description/quantity/unitPrice.
The mutation hook prevents concurrent submissions and locks the completed form while
navigation finishes. Failed requests preserve the form and show an error.

Success navigates to `/invoices`. That screen fetches its list again with the existing
no-store client. A tenant-scoped in-memory copy of the server result also highlights
the new draft, even when UUID ordering places it outside the current list page.
This highlight disappears on a full reload; the invoice itself is persisted.
Cancel returns to the invoice list. Finance viewers do not see a create action and
cannot use the form at the direct URL. API authorization is unchanged.

## Relevant frontend structure

```text
apps/web/
  app/
    page.tsx                         # thin server route
    invoices/page.tsx                # existing list in dashboard shell
    invoices/new/page.tsx            # creation route
  features/
    invoices/
      api/invoices.ts
      components/invoice-form.tsx
      components/invoice-client-select.tsx
      components/invoice-line-items.tsx
      components/invoice-summary.tsx
      hooks/use-create-invoice.ts
      hooks/submission-gate.ts
      schemas/invoice.schema.ts
      types/invoice.types.ts
    pages/workspace/
      dashboard-entry.tsx            # reused original session boundary
      page.tsx                       # existing dashboard orchestration
  components/                        # existing shared controls and shell
  lib/api.ts                         # existing authenticated API client
  test/invoice.test.mjs
```

The repository currently uses Next.js 16, React state and custom CSS, rather than
the task's assumed Next.js 15/TanStack Query/shadcn stack. No new UI, validation,
query-state or authentication library was added. Feature types reuse existing API
response types where available; no shared DTO package currently exists.

Only the root session entry was extracted to make it reusable by real routes.
Stable pages remain in their existing locations. Broader App Router conversion of
other dashboard sections is a separate possible task.

## Backend organization

Auth already has a Nest feature module. Clients and member controllers are grouped
under the general tenancy module; expenses/retainers are read-only there.
Invoices now have their own feature module:

```text
apps/api/src/invoices/
  dto/create-invoice.dto.ts
  utils/invoice-calculations.ts
  utils/invoice-dates.ts
  invoices.controller.ts
  invoices.service.ts
  invoices.module.ts
```

Existing invoice creation/list/item methods moved from the tenant service into a
request-scoped invoice service. The three routes, guards, transactions, calculations,
DTO contract and responses are preserved. Imports and unit tests were updated.
No Prisma changes or migrations were made. Separating organizations, members and
clients into additional modules would be a later task, not part of this change.

## Checks

Frontend: lint, type checks, production build, existing session/phone tests, and
new invoice tests for validation, item operations, precise calculations, payload
whitelisting, API failures, tenant-bound results, permissions and submission gating.
Backend: build, lint, type checks, unit tests and existing HTTP integration tests.
Test databases are retained when checks run with `KEEP_TEST_DATABASE=1`; development
data is not reset and no destructive cleanup is executed.

Invoice detail view, version-protected draft editing, explicit item ordering and
safe deletion are now implemented; see [Task 3](invoice-drafts.md). Server-side client
search can be added when client volumes outgrow the paginated selector.
