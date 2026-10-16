# Immutable invoice PDF storage

New invoice issuance renders the finalized billing snapshots and ordered line items
with PDFKit before the `DRAFT` to `ISSUED` transaction commits. The PDF excludes
payment totals, outstanding balances, and derived overdue state. It is uploaded to
the existing private S3-compatible bucket with an immutable conditional write, then
its internal object key is stored in nullable `Invoice.pdfKey`.

Objects use
`organizations/<organization UUID>/invoices/<invoice UUID>/<random UUID>.pdf`.
The object metadata records the organization UUID, invoice UUID, and SHA-256 digest.
Downloads first authorize and tenant-scope the invoice through PostgreSQL, then
validate the key prefix, PDF content type, signature, metadata ownership, and digest.
Object keys are removed from API responses.

Issuance holds the existing invoice row lock while it snapshots, renders, uploads,
and performs the conditional database update. Rendering or upload failure rolls the
database transaction back, leaving the invoice as a draft. If the database write or
commit fails after upload, the service attempts to delete the staged object and logs
a cleanup failure. A process crash between upload and commit can still leave an
unreferenced object; a future maintenance command may safely remove objects that have
no matching `Invoice.pdfKey`. Stored PDFs are never replaced or deleted through an
invoice API.

Issued and paid invoices created before this migration have a null `pdfKey`. Their
existing download endpoint continues to render from their preserved database
snapshots. This compatibility fallback does not write or alter historical records.
A future explicit backfill may render and attach those records after review.
