# Employee management

PuffinPal keeps employee records separate from login accounts. Owners and administrators can create and update employees, organize departments, assign managers, terminate employment, and optionally link one employee to one organization user. Project managers can view the directory. Finance viewers can view the directory and salary history; salary editing remains limited to owners and administrators.

Departments use organization-scoped unique names. An assigned department cannot be deleted. Managers are informational only: assignment grants no permissions, must stay inside the tenant, and is rejected when it would create a self-reference or reporting cycle. Employee statuses are `ACTIVE`, `ON_LEAVE`, `INACTIVE`, and `TERMINATED`; termination is an explicit version-checked action and retains all history.

Salary structures are effective-dated, tenant-scoped records using `Numeric(12,2)` values. Overlapping date ranges for an employee are rejected under a row lock. New structures preserve prior history, components record earnings or deductions, and normal employee responses never contain compensation.

When a future structure follows an open current structure, the current period is closed on the preceding day using its expected version. A stale revision fails rather than overwriting concurrent work. Components are fixed inputs only; PuffinPal does not interpret them as taxable or run payroll.

The API derives `organizationId` from the authenticated request. Composite foreign keys enforce same-organization departments, managers, linked users, salaries, and audit actors. Employee updates use an expected version. Creation, edits, status changes, termination, and salary creation append audit events.

## Endpoints

- `GET/POST /api/v1/employees`
- `GET/PATCH /api/v1/employees/:id`
- `POST /api/v1/employees/:id/terminate`
- `GET/POST /api/v1/employees/:id/salary-structures`
- `GET/POST /api/v1/departments`
- `PATCH/DELETE /api/v1/departments/:id`

Apply the additive `20261018T0705_employee_management` and `20261018T0709_employee_salary_history_fields` migrations before using these endpoints. The feature does not calculate payroll, tax, payslips, attendance, or leave balances.

## Manual verification

1. Apply all pending migrations in a disposable/local environment and sign in as an owner.
2. Create two departments, add two employees, link one to an existing member, and assign the other as manager.
3. Confirm duplicate codes, self-management, manager cycles, and deleting an assigned department are rejected.
4. Add a current salary with an allowance, then schedule a later salary. Confirm both periods remain in history without overlap.
5. Sign in as a project manager and verify salary controls and salary API access are unavailable.
6. Sign in as a finance viewer and verify salary history is read-only.
7. Terminate an employee and confirm the record and salary history remain visible and ordinary editing is disabled.

The employee tables are not included in dashboard expense totals. Future payroll work should create separate payable/payment records rather than treating configured compensation as cash spent.
