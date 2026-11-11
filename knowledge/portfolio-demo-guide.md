# PuffinPal portfolio demo guide

PuffinPal is a personal full-stack portfolio project, not a commercial SaaS offering.
This guide uses local operation; it does not assume a public deployment. Feature
expansion is finished. The goal is to explain an existing system clearly.

## Prepare before recording or interviewing

1. Follow the root [README](../README.md) and keep PostgreSQL, Redis, SeaweedFS,
   web, API and the separate worker running. Confirm Swagger is reachable.
2. Use a fresh, disposable **local demo database** configured through `DATABASE_URL`
   and apply the existing migrations. Do not reset or seed an existing database.
   Alternatively, register a distinctly named fictional organization in local development;
   note that the app has no self-service organization deletion workflow.
3. Register “Northstar Studio Demo” with a `.test` email and a locally chosen password.
   Use Team to provision a second ADMIN with a different password. Keep credentials
   outside screenshots and source control. Payroll creators cannot approve their own run.
4. Use one currency throughout, such as USD. Create fictional “Cedar Design” as a client
   and “Harbor Supplies” as a vendor. Avoid actual customer/person details or bank credentials.
5. Prepare an invoice for 100.00, issue it, and record a 25.00 payment. Keep its detail
   page ready so the remaining 75.00 and PDF can be shown. Prepare a draft invoice to edit.
6. Prepare an approved 40.00 bill with a 10.00 payment, leaving 30.00 outstanding.
   Create a small expense with a receipt and complete its approval. For a linked example,
   use an existing linked fixture if available; the bill editor does not create expense links.
   Do not use direct database edits to manufacture a demo workflow.
7. Create fictional employee “Alex Example,” hired before the payroll period. Add a fixed
   monthly salary effective before the period, matching organization currency. Use a complete
   calendar month, calculate and submit a run; approve with the second user, then finalize.
   Wait for the worker to complete its payslip. Do not attempt hourly/prorated payroll.
8. Keep a second browser profile for the approver, a completed payslip, and a recorded
   payable settlement ready. Pre-stage long workflows rather than waiting during the demo.

The existing seed (`apps/api/src/infrastructure/database/seed.ts`) creates only the
`puffinpal-demo` organization and owner membership. It requires `SEED_OWNER_PASSWORD`,
preserves existing rows/passwords, and does not generate invoice/expense/payroll fixtures.
Manual preparation avoids adding a new seeding system or hardcoded credentials.

For safe cleanup, stop the processes using the disposable database, confirm its exact name,
and remove only that database through your local database tooling. Never drop `puffinpal_dev`
or shared data to clean up a demonstration. There is no automatic demo-data removal script.

## Five-minute walkthrough

| Time      | Show                                                                   | Explain                                                                                                                                                                   |
| --------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00–0:40 | Financial overview, 30-day/month filter and currency labels            | Invoiced value is distinct from collections. Approved expense costs are distinct from cash paid. Net cash movement uses recorded payments.                                |
| 0:40–1:35 | Client list, prepared draft edit, issued invoice detail/PDF            | Drafts can change; issuance captures billing snapshots. Show payment history and 75.00 remaining after a 25.00 payment.                                                   |
| 1:35–2:05 | Record the remaining invoice balance if desired                        | Server validates amount, tenant, permission and balance. Refresh the detail to show full payment; do not enter a second payment accidentally.                             |
| 2:05–2:55 | Prepared approved bill, partial payment/balance and expense settlement | Approval and settlement differ. Linked bills are the payment authority and do not duplicate expense costs. Payable reversals preserve history.                            |
| 2:55–4:10 | Employee salary, finalized payroll and downloaded payslip              | Effective dates, fixed-salary calculation, separate approver, immutable finalization and asynchronous document generation. Use Refresh details and payslips if necessary. |
| 4:10–5:00 | README architecture diagram and selected source files                  | Next.js UI → NestJS domain services → PostgreSQL; Redis/BullMQ worker; private S3-compatible documents; tenant/RBAC boundaries.                                           |

Keep actions short. If worker/storage is unavailable, show a previously generated document
and state the limitation; do not imply that the current job completed. For a brief interview,
show prepared states rather than live registration and payroll approval.

## Technical talking points and evidence

- **Next.js + NestJS:** App Router composes feature-owned React UI; Nest controllers validate
  DTOs and delegate business rules. This keeps HTTP/framework concerns separate from workflows.
  See [architecture](project-architecture.md), `apps/web/src/features` and `apps/api/src/modules`.
- **Multi-tenancy and RBAC:** request auth context supplies organization and role. Service
  queries scope by organization; composite foreign keys protect related records. Shared
  `packages/permissions/src/index.ts` drives backend guards and frontend visibility. The
  boundary is application scoping, not RLS or a separate database per tenant.
- **PostgreSQL + Prisma:** fixed-scale numeric columns, transactions and row locks enforce
  financial invariants. `apps/api/prisma` owns the schema/migrations; `packages/database`
  supplies the pinned Prisma 8 runtime. This uses the contract/ORM toolchain, not a v7 client.
- **Redis + BullMQ:** `apps/api/src/worker.ts` runs separately. Queues carry delivery state;
  durable business/job records remain in PostgreSQL. Retry behavior varies by job type;
  explain supported idempotency rather than promising exactly-once execution.
- **Private storage:** `apps/api/src/infrastructure/storage` wraps the S3 SDK. Downloads
  authorize records; invoice PDFs also validate ownership and integrity. SeaweedFS provides
  local S3-compatible storage. Object keys are not public download links.
- **Financial consistency:** `accounts-payable` uses version checks, locks, idempotency,
  retained reversal records and server balances. Reporting distinguishes issued revenue,
  collections, expense costs, obligations and cash movement without arbitrary FX rates.
- **Docker development:** Compose runs local dependencies, while web/API/worker can run
  in terminals. A Caddy/container deployment configuration exists, without a measured
  production-scale or public-deployment claim.

## Tradeoffs to discuss

| Choice in the code                                         | Benefit                                                            | Cost or limitation                                                                         |
| ---------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Monorepo and shared permission package                     | Changes across UI/API can be reviewed together                     | Toolchain/build coordination, including pinned Prisma and TypeScript versions              |
| Modular monolith plus worker                               | Domain boundaries without service-to-service deployment complexity | Domains share the database and API deployment                                              |
| Worker jobs for exports/payslips                           | Request handlers avoid long processing and jobs can retry          | Redis and a worker must run; failures need visible state and retry handling                |
| Synchronous invoice issuance snapshot/PDF                  | Issuance succeeds only with a finalized document                   | Rendering/storage extend the transaction; failed commits can leave orphaned objects        |
| Immutable issued records and append-only payable reversals | Audit history and stable documents                                 | Correction workflows are intentionally constrained; invoice/payroll reversals are deferred |
| Local SeaweedFS rather than managed storage                | Reproducible S3-compatible demonstration                           | Operator owns persistence, credentials and availability                                    |

These are observable design tradeoffs, not claims about benchmarked performance or the
original developer's undocumented motivations.

## Representative verification

Automated tests and browser observation are different evidence. Batch 7 uses existing
focused tests for invoice calculations/payment rules and PDFs; expense/linked settlement
rules; payroll calculation/PDF rules; dashboard ranges and currency contracts; and frontend
orchestration. New checks cover the changed payroll states and access summary.

Existing integration suites are available for deeper local demonstrations:

- `test/invoices.e2e.test.mjs`, `test/invoice-drafts.e2e.test.mjs`,
  `test/invoice-issuance.e2e.test.mjs`, `test/invoice-payments.e2e.test.mjs`
- `test/accounts-payable.e2e.test.mjs`, `test/expenses.e2e.test.mjs`
- `test/payroll-edge-cases.e2e.test.mjs`, `test/financial-reports.e2e.test.mjs`

Run selected suites with `node apps/api/scripts/test-auth-e2e.mjs test/<name>.e2e.test.mjs`
from the root after API compilation and infrastructure startup. Each invocation owns a
disposable database. Run suites separately if shared signup throttling interferes. Payroll
integration includes controlled storage fakes; it does not replace a live-worker/storage demo.
No fresh database integration run is claimed by this guide itself.

Before sharing, manually check client/create → draft/edit → issue/PDF → partial/full payment;
vendor/bill approval/payment/balance; expense approval/settlement/link navigation;
employee/salary → calculate/approve/finalize → payslip; and dashboard period/currency/navigation.
Also verify narrow-screen tables, keyboard dialog dismissal and owner/read-only controls.
Browser appearance and live worker behavior remain manual unless separately recorded.

## Screenshot checklist

Capture the six views in the [README](../README.md). Use a consistent viewport and theme;
include a narrow-screen check before recording. Hide credentials, tokens, notifications,
real organization data and unrelated browser tabs. Use clearly fictional names and dates.
Save actual captures under a chosen documentation-assets folder and link them from the
README only once they exist. The repository's PNGs are logos, not application screenshots.

## Limitations and project status

- Personal portfolio application; not offered commercially. A public deployment is not claimed.
- Operational reporting, not a general ledger or GAAP/IFRS statement; no FX conversion.
- Fixed-salary/full-period payroll; no automatic bank transfers or maintained country tax packs.
- No email invitations/self-service recovery, invoice/payroll payment reversals, credit notes,
  or automatic issued-invoice delivery. Some non-AP lists retain bounded first-page loaders.
- Banking payment batches are checklists; actual payroll payments must be recorded separately.
- Existing source/test evidence does not certify production readiness, security or throughput.

Optional future ideas remain frozen in [the scope document](mvp-scope-freeze.md).
They are not another development plan.

## Interview questions

1. **How is tenant leakage prevented?** Explain trusted request context, tenant-scoped
   services and composite foreign keys; contrast frontend visibility with backend enforcement.
2. **How do roles stay consistent?** Show shared permission types, default-deny API guards
   and checks against current membership; explain why hiding a button is insufficient.
3. **How do you prevent payment races?** Show server balance checks, row locks, expected
   versions where supported, and payment idempotency. Do not promise every request is idempotent.
4. **Why not sum money in JavaScript floats?** Explain fixed-scale PostgreSQL numeric values,
   decimal-string API contracts and minor-unit domain arithmetic; chart conversion is display-only.
5. **How do linked expenses avoid double counting?** Costs come from the expense; bill
   payments supply settlement evidence. Direct settlement is prohibited while a bill is linked.
6. **What happens when a worker fails?** Describe persisted job state, configured retries,
   failure visibility, manual retry and the separate worker process.
7. **What if S3 succeeds and the database fails?** Describe staged invoice storage,
   transaction rollback, best-effort cleanup and the remaining orphan-object limitation.
8. **Why a modular monolith?** Describe the actual shared deployment/database and domain
   modules; explain the reduced coordination cost and coupling tradeoff.
9. **How are reporting periods and currencies handled?** Inclusive dates, bounded ranges,
   server aggregation, currency-isolated views, no invented rates, and stale-response protection.
10. **What would you improve with more time?** Choose one documented limitation, explain
    its business-policy dependency, and emphasize that the portfolio scope is intentionally closed.
