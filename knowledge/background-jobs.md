# Background jobs and invoice exports

BullMQ uses the existing private Redis service and the separate `puffinpal:jobs`
prefix. Authentication throttling remains under `puffinpal:auth-rate-limit`.
PostgreSQL is the source of truth for export ownership, status, progress, expiry,
and the private archive reference. Redis contains delivery state only.

Start local infrastructure, API, web app, and worker in separate terminals:

```sh
make services.start
make run.api
make run.web
make run.worker
```

After a production build, run the worker with
`pnpm --filter @puffinpal/api start:worker`. Stop it with SIGTERM or Ctrl+C;
BullMQ waits for active work before closing. Worker logs are structured JSON inside
Nest log messages. Set `INVOICE_EXPORT_WORKER_CONCURRENCY` from 1 through 10; the
default is 2. Stop the worker after queueing an export, then restart it to verify
the waiting job survives.

Exports accept 1–50 unique issued, paid, or overdue invoice IDs. The worker reads
stored immutable PDFs and renders only historical invoices without `pdfKey`. ZIPs
stream directly into SeaweedFS through a bounded multipart upload and fail at 100
MiB. No invoice is silently omitted. Jobs retry three times with exponential
backoff. Deterministic archive keys and conditional writes let a retry adopt an
already completed upload after a database failure.

Archives use
`organizations/<organization UUID>/invoice-exports/<export UUID>/invoices.zip`.
They expire 24 hours after creation. An hourly BullMQ scheduler deletes expired
archives and marks their PostgreSQL records `EXPIRED`; failed and expired metadata
is deleted after seven additional days. Cleanup only operates on invoice-export
records and keys, never invoice PDFs or receipts.

For ECS/Fargate, deploy the API and `start:worker` command as separate services
using the same private PostgreSQL, Redis, and S3-compatible endpoints. Keep Redis
off public networks and use `rediss://` when the provider supports TLS.
