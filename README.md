# PuffinPal

Multi-tenant invoice, expense, and retainer management in a pnpm/Turborepo monorepo.
The current implementation includes authentication, tenant permissions, a NestJS API,
and a basic browser UI for testing the platform.

```sh
make install
make services.start
cp apps/api/.env.example apps/api/.env  # only when .env does not already exist
make build.packages
make prisma.migrate.deploy
make run
```

Web runs on port 3000; API on port 3001; Swagger at `/api/docs` in development.
See [development commands](knowledge/development.md) and [repository map](REPOKB.md).

Authentication and permissions: [API guide](knowledge/authentication.md).

Browser test UI: [frontend guide](apps/web/README.md).
