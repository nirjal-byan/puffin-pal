# Financial reporting

## Accounts payable integration

Payables reporting is backed by approved vendor bills and active payable payments. Aging uses each bill's remaining balance, and cash movement uses payment dates rather than approval dates. A bill linked to an expense does not create a second operating cost; its payment supplies settlement and cash-movement evidence for that expense. Reversed payments are excluded, while bank reconciliation is reported as confirmation rather than another cash event.

PuffinPal's financial reporting module aggregates existing tenant-owned records. It does not create a ledger or duplicate financial transactions.

## Architecture

- API: `apps/api/src/modules/financial-reports`
- Web: `apps/web/src/features/financial-reports`
- Navigation: Reports is a top-level product area in the compatible workspace shell.
- Endpoints require the authenticated tenant context; clients cannot submit an organization ID.

## Authoritative sources

| Metric              | Source and recognition date                                            |
| ------------------- | ---------------------------------------------------------------------- |
| Issued revenue      | Issued/paid/overdue invoice snapshots, by invoice issue date           |
| Collected revenue   | Invoice payment records, by payment date                               |
| Receivables         | Issued invoice total less recorded payments, as of the report end date |
| Recorded expenses   | Expense records, by expense date                                       |
| Operating expenses  | Approved expense records, by expense date                              |
| Payroll cost        | Finalized payroll-run snapshots, by payment date                       |
| Payroll paid        | Payroll payment records, by payment date                               |
| Cash inflow         | Recorded invoice payments                                              |
| Cash outflow        | Active payable payments plus recorded payroll payments, by payment date |
| Reconciled movement | Recorded payments linked to a non-reversed bank reconciliation         |

Draft invoices are excluded. Partial invoice and payroll payments are summed once. Bank imports do not create additional cash movement; reconciliation only confirms an existing payment.

## Reporting basis

The product calls the result an **Operational Profitability Report**, not a profit and loss statement. Issued-basis operational profit is:

```text
issued invoice revenue
− approved operating expenses
− finalized gross payroll
− employer statutory contributions
```

Employee deductions are already part of gross-to-net payroll and are not subtracted again. Zero-revenue periods are valid and can produce a negative operating result.

This report is not GAAP- or IFRS-compliant. PuffinPal has no general ledger, journal entries, depreciation, inventory accounting, opening-balance history, tax-liability ledger, or period-closing adjustments.

## Known data limitations

- Approved expense costs and cash outflows are distinct. Standalone expenses and linked bills settle through active payable payments; linked costs are counted once from expenses. Unlinked bills are obligations and cash evidence, but do not automatically become an expense in operational profitability.
- Invoice-payment reversal records are not modeled. Deleting or reversing an invoice payment is therefore not inferred.
- Projects are not linked to invoices, so revenue by project is unavailable.
- Forecast values are excluded from historical cash movement.

## Currency handling

Every request requires one ISO three-letter currency. Invoice and payroll data are filtered to that currency. Expenses currently inherit the organization's reporting currency because expense records have no currency column. No currencies are combined and no exchange rate is invented.

Money arithmetic and aggregation execute in PostgreSQL using fixed-scale numeric columns. API amounts remain decimal strings until display formatting.

## Filters and endpoints

All endpoints accept `from`, `to`, `currency`, and `groupBy=month|quarter|year`. Ranges are inclusive by calendar date and capped at five years.

- `GET /api/v1/financial-reports/overview`
- `GET /api/v1/financial-reports/revenue`
- `GET /api/v1/financial-reports/expenses`
- `GET /api/v1/financial-reports/payroll`
- `GET /api/v1/financial-reports/profitability`
- `GET /api/v1/financial-reports/receivables`
- `GET /api/v1/financial-reports/payables`
- `GET /api/v1/financial-reports/cash-movement`
- `GET /api/v1/financial-reports/export?format=csv|pdf`

## Permissions

- `financial-reports:read`: general financial aggregates.
- `financial-reports:export`: CSV and PDF summary exports.
- `financial-reports:payroll-read`: payroll reporting endpoint and sensitive payroll detail capability.

General reports contain organization-level payroll totals because payroll is an operating cost. Employee-level payroll is not exposed by the overview endpoint.

CSV cells that begin with spreadsheet formula characters are prefixed safely. CSV and PDF exports include the reporting period, currency, basis, and limitations.

## Batch 5 dashboard and reporting improvements (2026-11-11)

The existing `GET /dashboard/financial-summary` adds `metrics.cashOutflows`,
`metrics.outstandingPayables`, `trend[].outflows`, and an `attention` object containing
counts of overdue invoices, unpaid approved bills, pending expenses, and unsettled
approved standalone expenses, with the standalone balance amount. All aggregates
execute in tenant-scoped PostgreSQL; no financial directories are fetched by the dashboard.

Dashboard invoiced revenue uses issue dates, collections use payment dates, and approved
expenses use expense dates. Net cash flow now means collections minus active payable
payments minus payroll payments in the selected inclusive date range. Approval alone
never implies a cash outflow. Reversed payments are excluded; linked expense/bill
payments are counted once. Outstanding invoice and bill balances include payments
through the end date, independently of the range start. Standalone expense settlement
counts exclude every expense with a linked bill. Pending approval counts use current
approval state for expenses dated through the end date.

The dashboard uses organization currency only and explicitly excludes other invoice,
bill, and payroll currencies. Expense records inherit organization currency. No exchange
rates are used. Cash aggregates require financial-report and AP read permission;
AP balances require AP read permission, enforced in the backend. Unavailable aggregates
are null, not invented zeros. Navigation additionally checks the relevant frontend
permission; expense approval navigation requires approval permission.

Trend buckets clip their first and last periods to the selected range and fill missing
periods with zero. Reports add `trend[].employerContributions`; `trend[].payroll` retains
its gross-payroll meaning. Trend profit and chart costs now include employer contributions,
matching the existing headline profitability calculation. Zero-value chart bars no longer
imply activity. Report presets use UTC calendar dates, matching dashboard presets.
Invalid/reversed ranges and ranges exceeding 1,826 days are rejected before report requests.
Dashboard custom Apply uses the same validation. Both loaders ignore aborted responses;
reports hide old results when dates/currency change, show retryable errors, and catch
export errors. Exports are disabled while report data is unavailable or loading.

These are operational views using current approval and reversal state, not immutable
historical accounting snapshots. Dashboard attention links open the relevant module;
users can apply that module's server filters to examine the records. Forecast scenarios,
upcoming recurring projections, payment correction policy, and exchange-rate conversion
remain unchanged. Interactive browser verification remains manual.

## Manual testing

1. Sign in as an owner, administrator, or authorized finance viewer.
2. Open **Reports** from the top navigation.
3. Switch between current month, previous month, current quarter, and current year.
4. Compare issued revenue with issued invoices and collected revenue with recorded payments.
5. Confirm drafts, rejected expenses, draft payroll, and forecast values are absent.
6. Record a partial invoice payment and verify receivables decrease only by that amount.
7. Finalize a payroll run and verify gross payroll appears; record a payroll payment and verify paid payroll/cash outflow changes.
8. Reconcile a payment and verify the reconciled total changes without changing total cash movement.
9. Download CSV and PDF and verify period, currency, totals, and disclosure text.
10. Sign in without payroll-report permission and verify the payroll endpoint is forbidden.

No database migration is required for this reporting version.
