# Expense approvals

New expenses start as `DRAFT`, then move through `PENDING_APPROVAL` to either `APPROVED` or `REJECTED`. A rejected expense must be explicitly reopened before it can be edited and resubmitted. Every transition uses the current expense version and writes an append-only history event in the same PostgreSQL transaction.

`OWNER` and `ADMIN` can review expenses through `expenses:approve`. `OWNER`, `ADMIN`, and `PROJECT_MANAGER` can submit expenses through `expenses:submit`. A submitter cannot approve or reject their own expense.

The additive migration marks expenses created before this workflow as `APPROVED`. This preserves existing financial reports. Application-created expenses explicitly start as `DRAFT`. Dashboard expense totals, category charts, and cash-flow calculations include only approved expenses.

Draft receipts can be added, replaced, or removed. Pending, approved, and rejected records are immutable; rejected expenses must first return to draft through the reopen endpoint. Receipt downloads remain private and tenant-scoped in every state.

The migration is intentionally not applied automatically. Review and apply checked-in migrations using the repository's normal Prisma migration command before deploying the updated API.
