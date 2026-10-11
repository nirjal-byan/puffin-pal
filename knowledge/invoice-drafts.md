# Invoice details, draft editing and safe deletion

Task 3 extends the existing invoice feature without changing issuance, payments,
PDFs, email, authentication, or the organization-scoped permission model.

## HTTP API

All routes are below `/api/v1`, require a bearer access token, and derive tenant
identity from the authenticated request. Unknown or other-tenant invoice IDs
return 404; malformed UUIDs return 400. JSON money fields remain decimal strings.

| Endpoint               | Permission        | Roles                                         |
| ---------------------- | ----------------- | --------------------------------------------- |
| `GET /invoices/:id`    | `invoices:read`   | OWNER, ADMIN, PROJECT_MANAGER, FINANCE_VIEWER |
| `PATCH /invoices/:id`  | `invoices:update` | OWNER, ADMIN, PROJECT_MANAGER                 |
| `DELETE /invoices/:id` | `invoices:delete` | OWNER, ADMIN                                  |

GET returns the persisted invoice fields plus `client` and `items`. The client
projection contains only `id`, `name`, `email`, `companyName`, and `taxId`.
The invoice header, client and items are read within one REPEATABLE READ snapshot,
so a concurrent item replacement cannot produce mismatched totals and items.
Example selected response fields (actual response also includes invoice IDs,
nullable PDF URL, dates, notes, and timestamps):

```json
{
  "id": "2bc78467-d8ac-40a4-973e-a2cb68a72aa9",
  "invoiceNumber": "INV-ff926fc0-b0e6-4dac-bd09-f4b2d508e34f",
  "status": "DRAFT",
  "version": 1,
  "subtotal": "0.30",
  "tax": "0.00",
  "total": "0.30",
  "client": {
    "id": "74e344ea-2106-454a-8f25-744c2a186073",
    "name": "Example Client",
    "email": "client@example.test",
    "companyName": null,
    "taxId": null
  },
  "items": [
    {
      "id": "bee0cb78-5448-4495-9f01-74e327aa788b",
      "organizationId": "aeb36fd4-4f68-4dfd-ab1c-343792c45859",
      "invoiceId": "2bc78467-d8ac-40a4-973e-a2cb68a72aa9",
      "description": "Design services",
      "quantity": 3,
      "unitPrice": "0.10",
      "amount": "0.30",
      "position": 0
    }
  ]
}
```

PATCH uses a complete editable-field payload, rather than a partial item diff.
`clientId`, both dates, items, and `expectedVersion` are required. Notes are optional:
omitting notes preserves them, while `"notes": ""` (including whitespace-only input)
clears them to null. Null input is rejected. The edit UI always sends notes so that
clearing the textarea is explicit.

```json
{
  "expectedVersion": 1,
  "clientId": "74e344ea-2106-454a-8f25-744c2a186073",
  "issueDate": "2026-10-10",
  "dueDate": "2026-11-10",
  "notes": "",
  "items": [
    { "description": "Design services", "quantity": 7, "unitPrice": "0.10" }
  ]
}
```

Only DRAFT invoices can be edited. Identity and invoice number remain unchanged.
The existing calculation and date utilities enforce the creation rules, including
1–100 valid items, positive integer quantities, Numeric(12,2) capacity and ordered
calendar-valid dates. The client must belong to the authenticated organization.
Server-owned totals, status, organization IDs and version assignments are rejected.
A successful PATCH returns HTTP 200 with the updated invoice, client and replacement
items, including its incremented version. Item IDs are replaced on each successful
edit; their order is persisted explicitly.

DELETE requires a JSON body containing the version that the user reviewed:

```json
{ "expectedVersion": 2 }
```

Only DRAFT invoices may be deleted. Success returns HTTP 200:

```json
{ "message": "Draft invoice deleted successfully." }
```

The invoice deletion and composite-FK cascade of its line items occur in one
transaction. Non-draft edits/deletes return 409, as do stale mutation attempts.
A repeated delete of an already removed invoice returns 404.

## Concurrency and migration

Migration `20261011T1617_invoice_draft_version_order` adds two NOT NULL columns:

- `invoices.version Int DEFAULT 1` for optimistic concurrency.
- `invoice_items.position Int DEFAULT 0` for line-item ordering.

This is additive and preserves existing invoice data. New/edited invoices assign
zero-based positions in input order. Existing items retain position zero and use
ascending item UUID as a stable tie-breaker, preserving the former retrieval order.
Their original entry order cannot be recovered because it was never stored.

The migration updates emitted Prisma contracts, snapshots and the local `db` ref.
For another initialized environment, apply it with `make prisma.migrate.deploy`
and verify with `make db.verify`. Do not reset or seed the database.

PATCH and DELETE use a single SQL write filtered by invoice ID, organization,
DRAFT status and expected version. PATCH increments the version while holding the
row lock and replaces items in the same transaction. PostgreSQL rechecks the full
predicate after waiting for a concurrent writer. A stale write affects no row and
returns 409. A failed insert/delete rolls back the entire mutation, including the
version change. The installed ORM's `updateAll`/`deleteAll` terminals retain the
full predicates; its single-row helpers first resolve identity and are deliberately
not used for this concurrency check.

The browser pins the form's loaded version, including across access-token refresh,
and does not silently adopt a newer version. A 409 preserves entered fields, blocks
saving, and offers review or explicit discard-and-reload. Deletion likewise requires
reloading after a conflict. Future status-changing workflows must use this same
version protocol; direct database writes are not an application mutation API.

## Frontend

- `/invoices/[id]`: client, dates, notes, ordered lines, subtotal/tax/total, loading,
  error and not-found states, plus authorized draft actions.
- `/invoices/[id]/edit`: reused invoice form with existing values and line order.
- `/invoices`: detail links, draft edit/delete actions and the preserved item expansion
  and pagination. Successful edits/deletes clear the recent-created snapshot and
  navigation reloads the list with the existing no-store API client.

Delete uses an accessible modal HTML dialog with invoice identity, permanent-delete
explanation, cancel/error states and submission locking. No browser `confirm()` or
new UI/state libraries are introduced. Detail and form layouts support narrow screens.
Organization currency remains a display convention; invoices have no currency snapshot.

## Verification

```sh
pnpm build:packages
pnpm --filter @puffinpal/api build
pnpm --filter @puffinpal/web build
pnpm lint
pnpm typecheck
pnpm --filter @puffinpal/api test
pnpm --filter @puffinpal/web test
KEEP_TEST_DATABASE=1 pnpm --filter @puffinpal/api test:e2e
# Stop the normal frontend first: Next.js permits one dev server per checkout.
cd apps/api
node scripts/test-invoice-browser.mjs
```

The HTTP suite covers tenant isolation, every role, exact recalculation, validation,
notes clearing, non-draft restrictions, real overlapping writes, stale deletion,
and forced item-replacement/cascading-delete rollback. Unit tests cover form mapping,
permissions, item operations, previews, payload/version contracts, failure propagation,
submission gating, and snapshot invalidation.

The browser runner requires local Docker/PostgreSQL, Google Chrome (`CHROME_BIN` may
select another Chromium executable), and free ports 3002, 3003 and 9223. It starts
isolated test servers, creates a separate migrated database and retains that database
and screenshots under `/tmp/puffinpal-invoice-browser`. It never creates development
accounts or drops databases. It exercises desktop/mobile details, prepopulation,
item operations, save failure/retry, conflicts, explicit reload, confirmation/cancel,
list expansion/deletion, role restrictions and not-found navigation. Restart the
normal frontend with `make run.web` afterward.

## Recorded results

Workspace production builds, lint, type checks, API unit tests (five files), web
unit tests (four files), and all 27 HTTP integration tests passed. Chrome workflows
passed at desktop and 390-pixel mobile widths, including dirty-form preservation
through token renewal. Prisma full verification confirmed that the migrated local
development schema and marker match the emitted contract, with no warnings.
No development database was reset, dropped, restored, or seeded. Test databases
were retained. No commit or push was performed.

## Changed files

Created:

```text
apps/api/prisma/migrations/app/20261011T1617_invoice_draft_version_order/migration.json
apps/api/prisma/migrations/app/20261011T1617_invoice_draft_version_order/migration.ts
apps/api/prisma/migrations/app/20261011T1617_invoice_draft_version_order/ops.json
apps/api/prisma/migrations/snapshots/f2ee70e027cd89598d87bec91f125b6a3c6be501b574355a0744e49d6fb89e67/contract.d.ts
apps/api/prisma/migrations/snapshots/f2ee70e027cd89598d87bec91f125b6a3c6be501b574355a0744e49d6fb89e67/contract.json
apps/api/scripts/test-invoice-browser.mjs
apps/api/src/invoices/dto/update-invoice.dto.ts
apps/api/test/invoice-drafts.e2e.test.mjs
apps/web/AGENTS.md
apps/web/CLAUDE.md
apps/web/app/invoices/[id]/edit/page.tsx
apps/web/app/invoices/[id]/page.tsx
apps/web/features/invoices/components/invoice-actions.tsx
apps/web/features/invoices/components/invoice-detail-page.tsx
apps/web/test/invoice.browser.mjs
knowledge/invoice-drafts.md
```

Modified:

```text
REPOKB.md
apps/api/prisma/migrations/app/refs/db.json
apps/api/prisma/schema/schema.d.ts
apps/api/prisma/schema/schema.json
apps/api/prisma/schema/schema.prisma
apps/api/scripts/test-auth-e2e.mjs
apps/api/src/invoices/invoices.controller.ts
apps/api/src/invoices/invoices.service.ts
apps/web/README.md
apps/web/app/globals.css
apps/web/components/financial-panel.tsx
apps/web/features/invoices/api/invoices.ts
apps/web/features/invoices/components/invoice-client-select.tsx
apps/web/features/invoices/components/invoice-form.tsx
apps/web/features/invoices/hooks/use-create-invoice.ts
apps/web/features/invoices/schemas/invoice.schema.ts
apps/web/features/invoices/types/invoice.types.ts
apps/web/features/pages/workspace/dashboard-entry.tsx
apps/web/features/pages/workspace/page.tsx
apps/web/lib/api.ts
apps/web/test/invoice.test.mjs
knowledge/authentication.md
knowledge/invoice-creation.md
knowledge/invoice-frontend.md
```

`apps/web/AGENTS.md` and `apps/web/CLAUDE.md` were generated automatically by
Next.js development startup and retained as the generated guidance requests.
