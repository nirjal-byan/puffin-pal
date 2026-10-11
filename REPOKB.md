# PuffinPal repository map

- `apps/api`: NestJS API, Prisma config, data contract, migrations, and seed entry point.
- `apps/web`: Next.js frontend (`@puffinpal/web`).
- `packages/database`: shared PostgreSQL runtime and Temporal setup.
- `packages/permissions`: shared role-to-permission policy.
- `packages/ui`, `packages/eslint-config`, `packages/typescript-config`: shared tooling.
- `services`: Compose infrastructure and SeaweedFS configuration directory.
- `knowledge`: development documentation and preserved starter docs app.

Prisma schema: `apps/api/prisma/schema/schema.prisma`.
Prisma migrations: `apps/api/prisma/migrations`.
Local service project: `puffinpal`; PostgreSQL volume: `puffinpal_postgres_data`.

Tenant foreign keys prevent cross-organization references. JWT authentication, current membership checks, permission guards and tenant-scoped
API reads, atomic draft invoice creation, version-protected editing and safe draft deletion are implemented. Financial retention rules, remaining business write workflows,
BullMQ and S3 integration remain to be implemented. Users are scoped to organizations with per-tenant email uniqueness.

See [authentication](knowledge/authentication.md) for endpoints and security boundaries.
