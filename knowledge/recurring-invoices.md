# Recurring invoices and retainers

Recurring schedules are stored in PostgreSQL and processed by the existing BullMQ worker. Start the API and worker with the existing `dev` and `dev:worker` scripts. The API installs a one-minute BullMQ scheduler; the worker finds due `ACTIVE` schedules and creates durable occurrence rows before generating invoices.

Dates are calendar dates at UTC midnight. Monthly, quarterly, and yearly schedules retain the start-day anchor and use the last day of shorter months. At most 12 missed occurrences are caught up in one scan. Draft generation is the default. Automatic issuance calls the same invoice issuance service used by the HTTP endpoint, including immutable PDF storage.

Set `RECURRING_INVOICE_WORKER_CONCURRENCY` from 1 to 10 (default 2). Redis uses the existing `BULLMQ_REDIS_URL` and `BULLMQ_PREFIX`. PostgreSQL occurrence uniqueness prevents duplicate billing periods.

Apply `20261018T0632_recurring_invoices` only after the earlier pending migrations. The implementation does not migrate the legacy `retainers` table; those records remain unchanged.
