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

## Known limitation

PuffinPal records payments but does not initiate bank transfers. Foreign-exchange conversion is not performed; bills and payments must use the same currency.
