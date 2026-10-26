# Financial reporting

PuffinPal's financial reporting module aggregates existing tenant-owned records. It does not create a ledger or duplicate financial transactions.

## Architecture

- API: `apps/api/src/modules/financial-reports`
- Web: `apps/web/src/features/financial-reports`
- Navigation: Reports is a top-level product area in the compatible workspace shell.
- Endpoints require the authenticated tenant context; clients cannot submit an organization ID.

## Authoritative sources

| Metric | Source and recognition date |
| --- | --- |
| Issued revenue | Issued/paid/overdue invoice snapshots, by invoice issue date |
| Collected revenue | Invoice payment records, by payment date |
| Receivables | Issued invoice total less recorded payments, as of the report end date |
| Recorded expenses | Expense records, by expense date |
| Operating expenses | Approved expense records, by expense date |
| Payroll cost | Finalized payroll-run snapshots, by payment date |
| Payroll paid | Payroll payment records, by payment date |
| Cash inflow | Recorded invoice payments |
| Cash outflow | Recorded payroll payments |
| Reconciled movement | Recorded payments linked to a non-reversed bank reconciliation |

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

- Expenses do not have payment records, so approved expenses are not presented as paid expenses or historical cash outflows.
- Vendor bills and accounts-payable payments are not modeled. The payable endpoint reports that it is unavailable rather than returning invented zero totals.
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
