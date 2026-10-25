# Banking and reconciliation

The Banking area records bank statement evidence and links it to payments already recorded in PuffinPal. It does not connect to a bank or move money.

## Data model

- **Bank account:** an organization-scoped display name, institution, account holder, masked identifier, country, currency, status, and default flag. Full credentials are never stored.
- **Import:** an immutable summary of a confirmed CSV file, including its SHA-256 source hash and row counts.
- **Bank transaction:** an imported credit or debit with an exact `numeric(14,2)` amount, currency, date, reference, and tenant/account-scoped fingerprint.
- **Reconciliation:** a one-to-one link from a bank transaction to an invoice payment or payroll payment.
- **Payment batch:** a checklist of still-unpaid obligations from one finalized payroll run. Creating a batch does not record payment or initiate a transfer.
- **Audit event:** records account, import, reconciliation, and batch actions with the actor and organization.

## Import workflow

1. Add an active bank account using only a masked identifier.
2. Choose **Import statement**, select the account, and upload a CSV of at most 2 MB and 5,000 rows.
3. The initial version expects these headers: `date`, `amount`, `description`, with optional `reference`, `direction`, and `currency`.
4. Dates use `YYYY-MM-DD`. Direction is `CREDIT` or `DEBIT`; when omitted, a negative amount is a debit and a positive amount is a credit.
5. Review the preview. Confirmation inserts new rows atomically and skips fingerprint duplicates. Re-importing the identical source file is rejected.

CSV text is treated as untrusted input. Values are validated and bounded before persistence. No spreadsheet export is produced, so imported formulas are never executed.

## Reconciliation

- Credits may match invoice payments; debits may match payroll payments.
- Candidates must be in the same organization, unreconciled, and have the exact amount and currency.
- Suggested records are never confirmed automatically. An authorized user must choose and confirm a match.
- Database uniqueness prevents a transaction or payment from being reconciled twice.
- Reversal removes only the reconciliation link and writes an immutable audit event. It does not delete the bank transaction or payment.
- Expenses are intentionally excluded because approval is not proof of payment in the current expense model.
- The initial version is strictly one bank transaction to one payment. Split and aggregate allocation are not supported.

Reconciled transactions are evidence for existing payments. They are not added to revenue, expense, dashboard, or cash-flow totals, preventing double counting.

## Payroll payment batches

Only finalized payroll runs with an outstanding balance are eligible. An entry already placed in a batch cannot be placed in another batch. Item statuses are `PENDING`, `ATTEMPTED`, `PAID`, or `FAILED`; a payment reference may be retained. A batch is operational tracking only and never marks payroll paid by itself.

## Permissions

- `banking:read`: view accounts, imports, transactions, batches, and audit history.
- `banking:manage`: manage accounts/imports and payment batches.
- `banking:reconcile`: confirm and reverse matches.

Owners and administrators receive all three. Finance viewers are read-only. Project managers and ordinary employee workflows do not receive banking access.

## Manual testing

1. Apply the reviewed Task 19 migration in a disposable environment.
2. Sign in as an owner, add a masked bank account, and preview/import a sample CSV.
3. Re-import the same file and confirm it is rejected; import overlapping rows from a different file and confirm duplicates are skipped.
4. Record an invoice payment, import a same-currency credit for the exact amount, confirm the suggestion, match it, then reverse it.
5. Verify a debit cannot match an invoice payment and a currency mismatch is rejected.
6. Finalize a payroll run, create a batch from its unpaid entries, and confirm those entries cannot be added to another batch.
7. Sign in as a finance viewer and confirm all write controls and endpoints are unavailable.
8. Verify financial overview and cash-flow totals do not change merely because a statement was imported or reconciled.

## Migration deployment

The migration package is `20261025T1556_banking_payment_reconciliation`, from contract `acebefa7812ba1d4d8d946d5db9f3ae475a02c785a10ffa8202bb48c9cbeb0cd` to `3e2878bed097dfdb8164710ad24a561d1792d7baafe2c150e42692accfa31039`. It contains additive tables, indexes, foreign keys, check constraints, and one tenant-scoped uniqueness constraint added to `payroll_payments`.

After backing up and testing in a disposable database:

```bash
cd apps/api
pnpm exec prisma migration status
pnpm run prisma:migrate:deploy
pnpm exec prisma migration status
```

Do not use `prisma db push`, rewrite earlier migrations, or mark a failed migration successful.
