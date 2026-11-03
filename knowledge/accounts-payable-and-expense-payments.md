# Accounts payable and expense payments

PuffinPal separates costs, obligations, settlement, and reconciliation:

```text
Vendor → Draft bill → Submit → Approve → Partial/full payments
                                      ↘ Bank reconciliation
Expense ─────────────── Approve ──────→ Payment (when no bill is linked)
```

## Data and lifecycle

- `Vendor` stores organization-scoped supplier details and payment terms. Vendors with history are archived, not deleted.
- `VendorBill` owns approval state (`DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `REJECTED`, `VOIDED`) and exact backend-calculated totals.
- Settlement (`UNPAID`, `PARTIALLY_PAID`, `PAID`) is derived from active `PayablePayment` rows and is never mixed into approval state.
- `PayablePayment` targets either a bill or a standalone expense. Positive amounts, matching currency, idempotency keys, row locks, and outstanding-balance checks prevent duplicate or concurrent overpayment.
- Reversals preserve the original payment, actor, reason, and time. An active bank reconciliation must be reversed first.
- `PayableAuditEvent` records vendor, bill, payment, and reversal actions without storing bank credentials.

## Single settlement authority

When a bill is linked to an expense, the bill is the only payment authority. Direct expense payments are rejected. Reports count the cost once from the expense and cash once from the bill payment.

## Attachments and banking

Bill PDFs and images are stored under organization-owned private SeaweedFS keys. The API validates type and a 5 MB limit, never returns object-store URLs, and permits replacement/removal only before approval.

Debit bank transactions can suggest active expense or bill payments by amount, currency, date, and reference. A user must explicitly confirm a match. Existing invoice and payroll matching is unchanged.

## Cash flow and reports

- Forecasting uses recorded payable payments as actual outflows and remaining approved bill balances at due dates.
- Linked expenses are excluded from standalone expense assumptions.
- `/financial-reports/payables` returns outstanding, overdue, aging, vendor balances, and payment totals.
- Expense reports distinguish recorded, approved, paid, and unpaid amounts.
- Cash movement includes active payable payments and their reconciliation state.

## Permissions and isolation

`vendors:read`, `vendors:manage`, `accounts-payable:read`, `accounts-payable:manage`, `accounts-payable:approve`, `accounts-payable:pay`, and `expenses:pay` separate viewing, preparation, approval, and settlement. Controllers enforce permissions and services derive the organization from the authenticated request; clients cannot select an organization ID.

## Migration

`20261026T1549_accounts_payable_vendor_payments` advances contract `3e2878…` to `d895b3…`. It creates the AP tables and extends the reconciliation target check for payable payments. The full migration chain was verified against disposable PostgreSQL. Review and deploy through the normal migration workflow; do not use `db push`.

## Manual test checklist

1. Add and edit a vendor, then verify search and tenant isolation.
2. Create a bill and verify line totals, submit, reject/resubmit, and approve permissions.
3. Upload and preview a PDF/image before approval.
4. Record two partial payments, verify the remaining balance, then complete payment.
5. Attempt a duplicate idempotency key and an overpayment.
6. Reverse a payment, then verify restored aging and balance.
7. Link a bill to an approved expense and confirm direct expense payment is rejected.
8. Reconcile a debit transaction and confirm reversal ordering is enforced.
9. Review Accounts Payable, Cash Flow, Expenses, Payables, and Cash Movement reports.

## Frontend Batch 1

The vendor directory supports all contact/payment fields, version-checked edits, and confirmed
archiving. Archive errors remain in the dialog; outstanding balances are enforced by the API.
Archived vendors remain visible for historical reference and are excluded from new bill choices.
Restoration is not supported by the API.

Draft bills can be edited with multiple lines, tax, discounts, dates, currency, vendor, reference,
and description. The form fetches current details and preserves existing expense links. A version
conflict keeps the form and entered values open; close and reopen to load the latest record.

The Attachment action shows filename, MIME type, and size and downloads through the authenticated
API. Users with bill-management permission can upload/replace/remove attachments on draft or rejected
bills only. Replacement and removal refresh the bill version and list/summary data. PDF, JPEG, PNG,
and WebP files up to 5 MB are supported. Removal requires confirmation. Read-only users can download.

Focused verification: `pnpm test:accounts-payable` from `apps/web`.
Manual checks: edit a vendor with custom terms, try archiving a vendor with an outstanding balance,
edit a multi-line draft without losing discounts or its expense link, provoke a stale version in
a second tab, then upload/download/replace/remove a bill attachment and verify approved bills are
read-only. Repeat with a finance viewer to confirm mutation controls are absent. Confirm downloaded
files match the originals. No database reset is required.

Approval exceptions, payment history/reversals, expense settlement UI, server pagination, and a
new expense-linking workflow remain outside this batch.

## Known limitation

PuffinPal records payments but does not initiate bank transfers. Foreign-exchange conversion is not performed; bills and payments must use the same currency.
