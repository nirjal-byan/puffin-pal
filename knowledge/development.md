# Development workflow

The lowercase root `makefile` follows the workflow of the reference project.
Run `make run.api` or `make run.web` to start one app, or `make run` for both.
`make build.packages` builds shared packages. `make lint`, `make lint.fix`, and
`make typecheck` run workspace checks. The API uses TypeScript watch mode to preserve
Nest decorator metadata. The API and shared database package use TypeScript 6 because the API ESLint parser
does not support TypeScript 7 and Prisma contract brands must resolve consistently
across those packages; the frontend and root retain TypeScript 7.

## Code formatting

Run `pnpm format` to format TypeScript, React, and Markdown files. Run
`pnpm format:check` in CI or before review to verify formatting without changing files.

## Local services

`make services.start` runs `services/docker-compose.yml` as project `puffinpal`.
PostgreSQL uses port 5433 and the `puffinpal_postgres_data` volume. Redis-backed
authentication throttling uses port 6379; SeaweedFS exposes S3 on 8333 and master
on 9333. `make services.stop` stops containers without deleting volumes. Copy
`services/.env.example` to `services/.env` if you need local overrides. Existing
database credentials must stay consistent with `apps/api/.env`; changing Compose
variables does not change credentials in an initialized volume.

Local Redis requires the password in `services/.env` and is bound to `127.0.0.1`.
The matching API URL is `redis://:<password>@127.0.0.1:<port>`. In production,
set `REDIS_URL` to a private TLS endpoint (normally `rediss://...`) and do not publish
the container's Redis port. `REDIS_RATE_LIMIT_PREFIX` isolates PuffinPal keys;
`REDIS_CONNECT_TIMEOUT_MS` and `REDIS_RECONNECT_MAX_RETRIES` bound connection attempts.
The API refuses to start without Redis, and an outage after startup makes throttled
authentication requests return 503. This fail-closed policy prevents an outage from
silently disabling credential-abuse protection. Redis contains only expiring,
namespaced request counters; it never contains credentials or JWTs.

For a fresh local `puffinpal_dev` database, run `make prisma.migrate.deploy` to
apply the committed migration history, then `make db.verify` to verify its marker.
This initializes the schema without resetting the database or seeding accounts.
Start the apps with `make run`; create your organization through the registration UI.
Use `make prisma.migrate.dev` when intentionally developing new schema migrations.

### Existing installations after rebranding

The renamed Compose project creates a new `puffinpal_postgres_data` volume. Existing
containers and volumes from the previous branding are left untouched. Stop the old
Compose project before starting PuffinPal so its containers release the service ports.
If you need existing records, back up the old database and restore it into the new
PostgreSQL service before using the app; do not delete the old volume until the restore
has been verified. Update local environment overrides to match the new defaults in
`services/.env.example` and `apps/api/.env.example`.

The authentication issuer, audiences, and refresh cookie also use PuffinPal identifiers.
Existing sessions require signing in again. The browser theme preference uses
`puffinpal-theme`; the new seed uses `puffinpal-demo` and `owner@puffinpal.test`.

## Prisma 8

CLI `8.0.0-rc.19` is retained with PostgreSQL runtime `8.0.0-rc.13`, matching its bundled
ORM toolchain. The schema, config, emitted artifacts, and migrations now live under
`apps/api`. `packages/database` supplies the runtime, not schema ownership.

- `make prisma.format`: `prisma contract format`.
- `make prisma.generate`: `prisma contract emit` (typed contract, no v7 client generator).
- `make prisma.migrate.dev`: emit, plan, and apply; advance the local `db` ref.
- `make prisma.migrate.deploy`: apply committed migration packages only.
- `make db.sync`: direct local schema synchronization with `prisma db update`.
- `make db.verify`: verify the live schema and marker.

Commit emitted `schema.json`/`schema.d.ts` and reviewed migration packages. Do not use
legacy Prisma 7 `migrate dev`, `migrate deploy`, or `migrate reset` with this CLI.
Local `.env` values now belong to `apps/api/.env`. The previous database-package env
is preserved as gitignored `packages/database/.env.previous`.

## Seed and reset

Set `SEED_OWNER_PASSWORD` to at least 12 characters and run `make database.seed`.
The seed creates `puffinpal-demo`, `owner@puffinpal.test`, and an OWNER membership in one
transaction. Re-runs preserve existing rows and passwords. Passwords use parameterized scrypt hashes. Authentication also accepts the previous
`scrypt:<salt>:<hash>` seed format.

`PRISMA_RESET_CONFIRM=puffinpal_dev make prisma.reset` deletes the local public and
Prisma marker schemas, then replays migrations. It is restricted to the local
`puffinpal_dev` database on port 5433 and refuses production mode. Reset is never run
as part of installation, migrations, or seeding.

## Reference layout

`apps/docs` was preserved under `knowledge/starter-docs` and is excluded from the
workspace. The screenshot does not show the contents of the other project's API
or shared packages; those internals retain PuffinPal's implementation.

Authentication setup and endpoints: [authentication.md](authentication.md).

## Adminer

`make services.start` also starts Adminer at http://localhost:8080.
Choose PostgreSQL and server `postgres`; use the credentials from `services/.env`
or the defaults `puffinpal_admin` / `puffinpal_password`, database `puffinpal_dev`.
Adminer is bound to localhost and stops with `make services.stop`.
