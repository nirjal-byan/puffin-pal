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

Batch 1 leaves approval exceptions and payment history/reversals to Batch 2 below. Expense settlement UI, server pagination, and a new expense-linking workflow remain outside both batches.

## Frontend Batch 2

Bills expose confirmed submit, approve, reject (with a required 1–500 character reason), resubmit,
and void actions according to backend lifecycle and the separate manage/approve permissions.
Voiding is available only for approved bills with no active payment amount; the server rechecks
payments before voiding. Version conflicts preserve the dialog and rejection reason. Use **Reload
latest bill** to explicitly fetch the current version; actions are disabled if the latest status
or permissions no longer permit them. Nothing automatically retries a financial mutation.

**Details / payments** loads bill details, backend-calculated balances, payment records, and bill
audit events. It displays current approval/settlement state, previous rejection reasons, payment
methods, dates, references, notes, and recorded/reversed audit identity, date, and reason. Empty,
loading, error, and explicit reload states are included. Reversed records remain visible and are
excluded from applied-payment totals by the backend.

Users with `accounts-payable:pay` can select an active payment, review the amount/reference,
enter a required reason, and explicitly confirm reversal. The existing version-checked reversal
endpoint preserves the original row. Duplicate clicks are blocked. Reconciliation conflicts are
shown with the instruction to reverse the bank reconciliation first. On success, bill details,
payment history, and the parent AP list/summary reload from the API; no frontend balances are
adjusted. Existing cash-flow/reporting queries already exclude reversed payments.

Backend boundaries are unchanged: rejected bill **fields and lines cannot be edited**, and no
reopen-to-draft endpoint exists. Rejected attachments can be corrected through Batch 1 and the
bill resubmitted. Broader rejected-field corrections require a separate lifecycle decision.
Void accepts a version only; it has no reason field. Payment endpoints expose audit user IDs,
not user display names, and do not expose reconciliation eligibility in their list response;
the server authoritatively rejects reconciled-payment reversals.

Verification includes focused service/hook tests, actual confirmation-dialog handler tests, and
server-rendered payment-history/permission/empty-state tests, using the installed Next.js compiler.
Run `pnpm test:accounts-payable` in `apps/web`. Browser and Docker-backed integration checks remain
manual in this environment.

Manual checks:

1. Submit a draft; reject it with a reason as an approver. As a preparer, review its reason and
   audit, correct its attachment, resubmit, and approve. Confirm rejected field edits remain absent.
2. In two tabs, change a pending bill in one and try rejecting its old version in the other.
   Confirm the reason remains and **Reload latest bill** disables the now-invalid action.
3. Record multiple partial payments, then open **Details / payments**. Check amounts/references,
   dates, methods, and the server's outstanding balance. Also check a bill with no payments.
4. Select an active payment, cancel once, then enter a reason and confirm reversal. Check the
   original record remains marked reversed, its audit is shown, and the list/summary balance updates.
5. Attempt a reconciled-payment reversal; check the actionable error. Repeat as a read-only user:
   history is visible, while approval/reversal controls are absent.
6. Reverse all active payments on an approved bill, then confirm voiding. Check the preserved history.

Expense settlements, first-100 list pagination, new expense linking, and rejected-field reopening
remain deferred. No schema, financial calculation, authorization, or infrastructure changes are made.

## Expense settlement integration — Batch 3

The existing relationship is one expense to at most one bill (`vendor_bill_expense_key`), and a
bill references at most one expense. Expense cost and bill obligation are separate views of the
same linked cost. No expense or payment is automatically cloned when navigating between them.
Standalone approved expenses use `PayablePayment` with target `EXPENSE`; linked expenses use the
bill's `VENDOR_BILL` payments. Approval and settlement remain independent states.

`GET /expenses/:id/settlement` adds the missing read-side integration: organization-scoped
expense/bill authority, currency, original cost, obligation amount, active paid amount, outstanding
balance, status, and retained payment history. Bill metadata/payment audit requires AP read
permission; expense read permits the expense settlement amounts and its direct payment history.
Expense list/detail responses also include settlement badges and server-calculated balances.
All amounts remain exact decimal strings derived with integer cents on the server.

The Expenses **Settlement** action records partial/full payments only for approved standalone
expenses with `expenses:pay`. Submission is guarded, and retries within the same payment form keep
the same idempotency key and submitted values. Following an uncertain response, reload history
before starting a different payment. Confirmed reversals require a reason and current payment
version. Existing reconciliation restrictions remain enforced. List, detail, and settlement
history reload after success. Related reporting/forecast views load fresh on navigation; no
frontend financial balances or secondary settlement records are maintained.

Linked expenses expose **Open bill** instead of direct payment creation. Bill activity exposes
its linked expense with approval and settlement information, guarded by expense read permission.
The links open the specific record even if it is outside the current list page. Missing linked
records produce an error, not an invented zero balance. Reversing a bill payment reloads the
linked expense view alongside bill history and the AP list/summary.

Linking and direct payment writes serialize on the expense row. A bill cannot be attached to an
expense with active direct payments, and direct-payment creation rechecks the link after locking.
Earlier direct payments on a historically linked expense remain visible separately and may be
reversed using expense-payment permissions. Active legacy direct payments block further payment
of the linked bill until corrected. Reversal routes now constrain the payment target type as well
as tenant/version; an expense reversal route cannot reverse a vendor bill payment.

Financial consistency fixes:

- Forecasting excludes standalone events for expenses linked to bills in **any** state. Only an
  approved bill emits its remaining payable obligation; draft/rejected/voided bills do not silently
  turn back into standalone expense obligations. Active payment outflows remain separate events.
- Forecasting rejects mixed-currency payable sources, consistent with its one-currency model.
- Expense report costs belong to the organization's currency, and settlement sums filter payment
  currency. Requesting another currency no longer labels these costs with the requested currency.
- Report cost totals count an approved expense once. Paid expense costs are capped at the expense
  amount, AP balances use bill amounts, and cash movement uses active payment rows. Reversals leave
  cost history intact and remove the reversed payment from active cash/paid totals.
- The Overview expense/net cash flow cards retain their existing approved-expense-date basis.
  Settlement cash reports use payment dates; the settlement dialog explains the distinction.

A linked bill may have a different amount/currency than its original expense. The UI explicitly
separates original expense cost from the bill obligation and performs no currency conversion.
Creating new links through a picker, rejected-bill field reopening, vendor restoration, and
server pagination remain outside this batch. Expenses inherit the organization's currency;
there is no separate historical expense-currency model or general ledger.

Verification: focused API, frontend service and actual dialog-handler tests, AP/report integration
in disposable PostgreSQL, TypeScript checks, and targeted lint. Integration checks cover partial
and full settlement, tenant isolation, linked payment/reversal history, reporting without duplicate
costs/cash, and currency filtering. Interactive browser verification remains manual.

Manual checks:

1. Open an approved standalone expense's **Settlement** dialog; record a partial payment, then the
   remainder. Verify list/details show partial then paid status and zero balance.
2. Reverse a payment with a reason. Verify it stays in history and the outstanding balance returns.
   Try a reconciled payment and check the instruction to reverse reconciliation first.
3. Open a linked expense and follow **Open bill**. Verify there is no direct settlement action.
   Pay/reverse the bill, then check its linked expense status and follow the expense link back.
4. Verify read-only users can inspect history but cannot pay/reverse; missing/other-tenant IDs fail.
5. Compare expense cost, paid/unpaid expense totals, AP outstanding, and cash movement reports after
   a partial payment/reversal. A linked bill must not create a second approved expense cost.

Run `pnpm test:accounts-payable` in `apps/web`, and `pnpm test:expense-settlement` in `apps/api`.
The latter owns disposable test databases and does not reset or seed the development database.

## Known limitation

PuffinPal records payments but does not initiate bank transfers. Foreign-exchange conversion is not performed; bills and payments must use the same currency.
