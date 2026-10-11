# Draft invoice creation

`POST /api/v1/invoices` creates a DRAFT invoice and its line items atomically.
It uses the existing request-scoped `InvoicesService`, authentication guard,
`invoices:create` permission and ordinary JSON response conventions.

## Request

Send a bearer access token and `Content-Type: application/json`:

```json
{
  "clientId": "74e344ea-2106-454a-8f25-744c2a186073",
  "issueDate": "2026-10-10",
  "dueDate": "2026-11-10",
  "notes": "Draft for review",
  "items": [
    { "description": "Design services", "quantity": 3, "unitPrice": "0.10" },
    { "description": "Hosting", "quantity": 2, "unitPrice": "12.25" }
  ]
}
```

The client UUID must identify a client in the authenticated organization.
Unknown clients and clients belonging to another tenant both return 404.

## Response

HTTP 201 returns the persisted invoice, including organization/client IDs,
number, DRAFT status, dates, notes, nullable PDF URL, timestamps, and all persisted
items with their IDs. Monetary fields are decimal strings. Selected fields:

```json
{
  "id": "2bc78467-d8ac-40a4-973e-a2cb68a72aa9",
  "organizationId": "aeb36fd4-4f68-4dfd-ab1c-343792c45859",
  "clientId": "74e344ea-2106-454a-8f25-744c2a186073",
  "invoiceNumber": "INV-ff926fc0-b0e6-4dac-bd09-f4b2d508e34f",
  "status": "DRAFT",
  "issueDate": "2026-10-10T00:00:00Z",
  "dueDate": "2026-11-10T00:00:00Z",
  "subtotal": "24.80",
  "tax": "0.00",
  "total": "24.80",
  "notes": "Draft for review",
  "items": [
    {
      "description": "Design services",
      "quantity": 3,
      "unitPrice": "0.10",
      "amount": "0.30"
    },
    {
      "description": "Hosting",
      "quantity": 2,
      "unitPrice": "12.25",
      "amount": "24.50"
    }
  ]
}
```

Actual item objects also contain `id`, `invoiceId`, and `organizationId`.

## Validation and calculations

- Between 1 and 100 items; descriptions must contain non-whitespace text and be at most 1000 characters.
- Quantities are JSON numbers and positive integers up to 2,147,483,647, matching the existing Int column.
- Unit prices are decimal strings, nonnegative, with up to 10 integer digits and 2 decimal places. Scientific notation, fractional quantities, numeric JSON prices, negative values and excess precision are rejected.
- Price, line amounts and accumulated total must fit Numeric(12,2), at most 9,999,999,999.99.
- All multiplication and summation use BigInt cents; no floating-point financial arithmetic or rounding occurs.
- Tax is zero and total equals subtotal. Client-supplied totals, tax, amount, status and organizationId are rejected by DTO validation.
- Dates accept ISO calendar dates or timestamps with an explicit timezone. Calendar dates mean UTC midnight; impossible dates and due dates preceding issue dates are rejected.
- Notes are optional strings up to 5000 characters.
- Currency is not accepted: the current invoice schema has no currency column. Existing UI conventions use organization currency.

Bad inputs return 400, missing authentication returns 401, and insufficient permission returns 403.
OWNER, ADMIN and PROJECT_MANAGER may create invoices; FINANCE_VIEWER may not.

## Persistence and numbering

No schema changes or migration are required. Existing composite foreign keys keep
invoice/client and item/invoice relationships within one organization. The existing
unique `(organizationId, invoiceNumber)` constraint prevents duplicate numbers.

The existing code only had `INV-1` fixtures and no production number generator.
New numbers use `INV-<full UUID>`, generated inside the transaction. This avoids
counting rows, scanning for the highest number, and counter races. Numbers are
unique identifiers, not sequential accounting numbers. A sequential or human-readable
numbering policy can be designed in a later task if required.

The invoice and each item are inserted in one PostgreSQL transaction. Failure on
any insert rolls back everything. Existing rows, numbering and endpoints are preserved.

## Verification

```sh
pnpm --filter @puffinpal/api build
pnpm --filter @puffinpal/api check-types
pnpm --filter @puffinpal/api lint
pnpm --filter @puffinpal/api test
KEEP_TEST_DATABASE=1 pnpm --filter @puffinpal/api test:e2e
```

The integration runner creates a separate local test database and applies existing
migrations to it. `KEEP_TEST_DATABASE=1` retains it without issuing DROP commands.
The invoice tests exercise real HTTP requests, parallel creation, role/tenant checks
and a test-only trigger that fails the second item insert to verify actual rollback.
The trigger exists only in that isolated test database. No development database
reset or destructive command was run for this implementation.

Invoice editing, issuance, emailing, PDF generation, payments and frontend changes
are outside this task.
