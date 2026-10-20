# Cash flow forecasting

PuffinPal’s cash flow forecast is a deterministic planning view built from the organization’s existing records. It does not use AI, statistical prediction, or hidden sample data. A forecast never creates or changes invoices, payments, expenses, recurring schedules, salary structures, or payroll runs.

## Sources and timing

| Source                              | Amount                                        | Forecast date                                                                            | Included by default |
| ----------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------- |
| Issued, pending, or overdue invoice | Invoice total minus recorded payments         | Due date plus the scenario’s collection delay; already overdue balances begin from today | Yes                 |
| Active recurring schedule           | Sum of schedule line items                    | Scheduled occurrence plus payment terms and collection delay                             | Yes                 |
| Finalized payroll                   | Entry net pay minus recorded payroll payments | Payroll payment date; overdue unpaid payroll begins from today                           | Yes                 |
| Approved payroll                    | Entry net pay minus recorded payroll payments | Payroll payment date                                                                     | Yes, configurable   |
| Fixed salary structure              | Base plus earning components minus deductions | Its estimated pay-frequency date                                                         | No, configurable    |
| Approved expense                    | Approved amount                               | Expense date, only when dated today or later                                             | No, configurable    |

Recurring projections skip occurrence slots that already have a recurring occurrence, so an actual invoice and its schedule projection are not counted together. Salary estimates skip dates covered by any existing payroll run. Hourly salary structures are excluded because future hours are unknown.

Expense records currently have approval state but no paid/unpaid state or reliable payment date. The forecast therefore never treats past approved expenses as future cash. When the approved-expense option is enabled, only future-dated approved expenses appear and the UI labels the expense date as a planning assumption.

All calculations use integer minor units. The API rejects a forecast containing eligible records in a currency different from the organization currency.

## Scenarios

- **Expected** uses the configured invoice collection delay (default: 7 days).
- **Conservative** adds the configured conservative adjustment (default: 14 more days).
- **Optimistic** uses its explicit delay (default: 0 days).

Scenarios change collection timing only. They do not change invoice amounts or reduce obligations. Forecasts support 1–365 days; the UI provides 30, 60, 90, 180, and 365-day choices.

## Opening balance

Closing-balance projections are shown only after an authorized user records an opening balance and effective date. The balance applies when its effective date is on or before the forecast start date. Without it, PuffinPal still shows inflows, outflows, net movement, and the event breakdown.

## API and access

All endpoints derive the organization from the authenticated request:

- `GET /api/v1/cash-flow/forecast`
- `GET /api/v1/cash-flow/summary`
- `GET /api/v1/cash-flow/breakdown`
- `GET /api/v1/cash-flow/configuration`
- `PATCH /api/v1/cash-flow/configuration`

`cash-flow:read` grants forecast access. `cash-flow:manage` grants configuration updates. Owners and administrators receive both; project managers and finance viewers receive read access. Configuration updates use an expected version and create an audit event containing changed field names, not secrets or financial payloads.

## Migration and deployment

Task 15 adds only `cash_flow_forecast_configurations` and `cash_flow_forecast_audit_events`, their indexes, check constraint, and foreign keys. The generated migration starts from `20261019T1218_attendance_leave_overtime` and uses explicit short names for all new composite foreign keys and indexes to stay within PostgreSQL’s 63-byte identifier limit.

Review and apply it through the normal deployment process:

```bash
cd apps/api
pnpm exec prisma migration status
pnpm run prisma:migrate:deploy
pnpm exec prisma migration status
```

Do not use `prisma db push`, reset the database, or edit previously applied migration files.

## Manual checks

1. Open **Workspace → Cash Flow** as an owner and save an opening balance and date.
2. Compare Expected, Conservative, and Optimistic. Invoice amounts should stay the same while collection dates move.
3. Record a partial invoice payment and verify only the outstanding amount remains.
4. Verify finalized payroll shows only its unpaid balance.
5. Enable recurring projections and confirm an already generated occurrence is not duplicated.
6. Enable approved future expenses and confirm the assumption label is visible; past expenses must remain excluded.
7. Sign in as a finance viewer and verify the page is readable but configuration is unavailable.
8. Try a cross-tenant record identifier indirectly through existing records; it must never appear because every query is organization-scoped.
