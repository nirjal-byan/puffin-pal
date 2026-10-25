# PuffinPal architecture

PuffinPal is a pnpm/Turborepo monorepo. The current architecture deliberately keeps existing URLs and session behavior stable while organizing business code by feature.

```text
apps/
├── web/
│   ├── app/                 # Next.js App Router, root layout, route boundaries
│   ├── components/          # Shared UI and application-shell components
│   ├── features/            # Business features and interactive page composition
│   │   ├── banking/
│   │   ├── invoices/
│   │   ├── onboarding/
│   │   └── pages/           # Existing query-driven workspace destinations
│   └── lib/                 # API client, navigation, and cross-feature helpers
└── api/
    ├── prisma/              # Contract schema and immutable migration packages
    └── src/
        ├── banking/         # Banking controller, DTOs, CSV parser, service
        ├── auth/            # JWT authentication and permission guards
        ├── database/        # Shared PostgreSQL access
        ├── redis/           # Shared Redis access
        ├── storage/         # S3-compatible storage
        └── <feature>/       # NestJS feature modules
packages/
├── database/                # Database package
├── permissions/             # Shared RBAC contract
└── ui/                      # Shared package-level UI primitives
```

## Frontend conventions

- `app/layout.tsx` is the only root document layout and owns metadata, fonts, and global CSS.
- App Router files compose routes; interactive business UI lives under `features/`.
- The existing authenticated workspace remains query-driven to preserve public URLs and session behavior. A broad route-group migration should be a separate, tested project rather than a blind directory move.
- Shared modal, field, dropdown, date, snackbar, shell, and navigation components live in `components/`. Feature-specific UI stays with its feature.
- Requests go through the typed `WorkspaceApi`/`apiRequest` client so authentication expiry and errors behave consistently.
- Client Components are used where browser state or interaction is required. The root layout remains a Server Component.

## Backend conventions

- Each domain is a NestJS module containing its transport, DTO validation, and business workflows.
- Controllers authorize and delegate. Services own transaction boundaries and invariants.
- Shared database, Redis, queue, and storage modules remain infrastructure boundaries; they are not duplicated inside features.
- Tenant-owned reads and writes always include `organizationId`. Cross-tenant identifiers must return not found or fail validation.
- Money uses fixed-scale PostgreSQL numeric values and integer minor-unit calculations, never floating point.
- Public request shapes use validated DTOs. Database uniqueness backs concurrency-sensitive invariants.

## Naming and imports

- Use descriptive domain names and kebab-case files.
- Keep types close to the owning feature. Promote code to shared components only after it has a genuine cross-feature responsibility.
- Prefer existing TypeScript aliases/packages; use relative imports only within a nearby feature.
- Avoid generic repositories that merely mirror the ORM and avoid catch-all utility folders.

## Testing

- Unit tests live under each app's `test/` directory.
- Database-backed flows use the existing authenticated E2E harness and a disposable database.
- Every feature change should run type checks, lint, production builds, focused unit/E2E tests, and `git diff --check`.
- Migration plans are generated offline, reviewed for destructive operations, then verified against a disposable database before deployment.

## Adding a feature

1. Add the validated DTO, service, controller, and NestJS module; register the module in `app.module.ts`.
2. Add tenant-scoped schema changes and generate one migration from the actual current contract head.
3. Add feature-local frontend types/API helpers/components, then compose them into an App Router destination or the existing workspace shell.
4. Add shared permissions to `packages/permissions`, enforce them in the controller, and hide unavailable navigation/actions in the UI.
5. Add focused unit tests plus database-backed tests for tenancy and concurrency-sensitive behavior.
