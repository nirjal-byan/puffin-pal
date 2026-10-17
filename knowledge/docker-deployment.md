# PuffinPal Docker deployment

This guide runs PuffinPal as a production-like stack on one Docker host. It prepares the repository for a future EC2 deployment; it does not provision AWS infrastructure.

## Docker concepts

An **image** is an immutable application package. A **container** is a running instance of an image. Docker Compose describes a group of containers, their private networks, environment, health checks, and persistent volumes.

The API and worker share the same compiled application image but run different commands. The API serves HTTP. The worker consumes BullMQ jobs and can be restarted or scaled without interrupting HTTP traffic.

Inside a container, `localhost` means that container. Services therefore connect using Compose DNS names such as `postgres`, `redis`, and `seaweedfs`. Only Caddy publishes host ports; PostgreSQL, Redis, SeaweedFS, the API, and the worker remain private.

## Files

- `apps/web/Dockerfile`: multi-stage Next.js standalone image, running as a non-root user.
- `apps/api/Dockerfile`: multi-stage NestJS API/worker image plus a migration target.
- `compose.production.yml`: production-like topology and persistent volumes.
- `deploy/Caddyfile`: same-origin `/api/*` proxy and frontend routing.
- `.env.production.example`: deployment variable template.
- `.dockerignore`: excludes local dependencies, outputs, environments, and development material.

## Initial setup

Requirements: Docker Engine with Compose v2, ports 80/443 available, and enough memory for builds.

```bash
cp .env.production.example .env.production
chmod 600 .env.production
```

Replace every `replace-with-...` value. Generate secrets, for example:

```bash
openssl rand -base64 48
```

If a password contains URL-reserved characters, percent-encode it in `DATABASE_URL`, `REDIS_URL`, and `BULLMQ_REDIS_URL`. The direct `POSTGRES_PASSWORD` and `REDIS_PASSWORD` values remain unencoded.

For local HTTP, retain:

```dotenv
CADDY_SITE_ADDRESS=http://localhost
CADDY_HSTS=max-age=0
WEB_ORIGIN=http://localhost
COOKIE_SECURE=false
```

For a real deployment, point DNS at the host and use:

```dotenv
CADDY_SITE_ADDRESS=billing.example.com
CADDY_HSTS=max-age=31536000; includeSubDomains
PUBLIC_APP_URL=https://billing.example.com
WEB_ORIGIN=https://billing.example.com
COOKIE_SECURE=true
```

Caddy then obtains and renews TLS certificates automatically. Ports 80 and 443 must be reachable. Do not use a public hostname during local testing.

`NEXT_PUBLIC_API_URL` is compiled as `/api/v1`; it contains no secret and makes browser requests same-origin. Never place credentials in a `NEXT_PUBLIC_*` variable because Next.js embeds those values in browser assets.

## Validate, build, migrate, and start

```bash
make production.validate
make production.build
```

Before the first migration or any schema upgrade, take a backup:

```bash
docker compose --env-file .env.production -f compose.production.yml up -d postgres
mkdir -p backups
docker compose --env-file .env.production -f compose.production.yml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "backups/puffinpal-$(date +%Y%m%d-%H%M%S).dump"
```

If shell variables are not exported, substitute the values from `.env.production`. Store backups outside the Docker host as well.

Verify migration state, then apply existing migrations explicitly:

```bash
make production.migrations.verify
make production.migrate
make production.migrations.verify
```

The API does not run migrations at startup and production never uses `db push`, reset, or seed commands.

Start the stack:

```bash
make production.start
make production.health
```

Open `http://localhost` for local HTTP. Check the public liveness endpoint at `http://localhost/api/v1/health` and readiness at `http://localhost/api/v1/health/ready`. Readiness returns only a controlled status and checks PostgreSQL, Redis, and private object storage.

## Operations

View all logs or one service:

```bash
make production.logs
docker compose --env-file .env.production -f compose.production.yml logs -f api
docker compose --env-file .env.production -f compose.production.yml logs -f worker
```

Inspect health and resource use:

```bash
make production.health
docker stats
docker compose --env-file .env.production -f compose.production.yml exec postgres pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"
docker compose --env-file .env.production -f compose.production.yml exec redis sh -c 'REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli ping'
docker compose --env-file .env.production -f compose.production.yml exec seaweedfs wget -qO- http://127.0.0.1:9333/cluster/status
```

Restart the worker gracefully and verify queued jobs survive:

```bash
make production.worker.restart
docker compose --env-file .env.production -f compose.production.yml logs --tail=100 worker
```

Redis uses append-only persistence. BullMQ queue data therefore survives worker and application restarts. Jobs are not safe if the Redis volume is deleted.

Rebuild one service after code changes:

```bash
make production.rebuild SERVICE=api
make production.rebuild SERVICE=web
make production.rebuild SERVICE=worker
```

Stop safely without deleting data:

```bash
make production.stop
```

Never add `-v` to `docker compose down` for this stack. Removing volumes deletes PostgreSQL records, Redis queue state, SeaweedFS objects, and/or Caddy certificates. Recreating only application containers preserves named volumes.

## Persistent data and restore

Named volumes preserve:

- `postgres_data`: organizations, users, invoices, payments, expenses, and export metadata.
- `redis_data`: throttling counters and durable BullMQ queue state.
- `seaweedfs_data`: immutable invoice PDFs, receipts, and temporary export archives.
- `caddy_data` and `caddy_config`: TLS certificates and Caddy state.

Restore PostgreSQL only into an intentionally selected database after taking a fresh backup and stopping write traffic:

```bash
cat backups/puffinpal.dump | docker compose --env-file .env.production -f compose.production.yml exec -T postgres \
  pg_restore --clean --if-exists -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

Test restore procedures using disposable volumes before relying on them. Back up SeaweedFS data at the volume or filesystem level while writes are quiesced. Preserve Redis if pending/retryable jobs matter; PostgreSQL and SeaweedFS remain the durable business and object records.

## Architecture and security

Caddy is the only public service. It routes `/api/*` to NestJS and everything else to Next.js, forwards standard proxy headers, supports WebSocket upgrades automatically, compresses responses, and sets baseline security headers. NestJS trusts one proxy hop and Helmet supplies application HTTP headers.

Application containers run as non-root users. Log files use Docker rotation. Compose applies practical memory limits. Production credentials are supplied at runtime and are absent from image layers. Required values use Compose validation and fail before startup when missing. Swagger is disabled when `NODE_ENV=production`.

The local infrastructure file under `services/` remains intended for host-run development and exposes loopback ports. The production file exposes no PostgreSQL, Redis, SeaweedFS, API, or worker port.

## Troubleshooting

Validate resolved configuration without printing it into tickets or logs:

```bash
make production.validate
```

Then inspect `make production.health` and service logs. Common causes are mismatched URL-encoded passwords, unavailable host ports, a stale image after source changes, insufficient memory, or DNS/TLS not pointing to the host.

If a dependency is unavailable, the API readiness check fails and Caddy does not route to an unhealthy initial API. Redis clients use bounded reconnect policies. BullMQ retries jobs with its configured backoff. A failed worker can restart independently.

## Future EC2 prerequisites

Before EC2 deployment:

1. Select an instance with sufficient CPU, memory, and encrypted disk capacity.
2. Install Docker Engine and Compose v2, enable Docker at boot, and restrict SSH access.
3. Allow inbound 80/443 only; keep database, Redis, SeaweedFS, and Docker daemon ports closed.
4. Point a real DNS name to an Elastic IP and configure the HTTPS values above.
5. Supply `.env.production` through a protected deployment mechanism or secret mounts, not Git.
6. Configure off-host encrypted PostgreSQL and SeaweedFS backups and test restores.
7. Configure host/container log retention, disk alerts, health monitoring, and OS/image patching.
8. Run migration verification, back up, then run the explicit migration job during releases.

This single-host design is suitable for an initial EC2 deployment. Moving PostgreSQL, Redis, or object storage to managed services later requires changing URLs and credentials, not application architecture.

