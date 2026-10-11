# PuffinPal test UI

Run `make services.start` and `make run` from the repository root, then open
http://localhost:3000. The API runs on port 3001.

The frontend uses the live API. You can:

- Create an organization and its owner account, or sign in with organization slug/email/password.
- Add/edit clients and view paginated records.
- Provision team accounts and change roles when permitted.
- Sign in as a viewer or project manager to inspect the different controls.
- Create draft invoices at `/invoices/new`; view invoices and their items, expenses, and retainers.
- Review your current permissions on My access and refresh them after a role change.

Use two different organization accounts to check that records remain separate.
Expenses and retainers remain read-only. Invoice details, draft editing and safe
draft deletion are available at `/invoices/[id]` and `/invoices/[id]/edit`. Issuance
remains future work. See [draft lifecycle](../../knowledge/invoice-drafts.md). See [invoice UI and architecture](../../knowledge/invoice-frontend.md).

Access tokens stay in React memory and expire after 15 minutes. A seven-day
HttpOnly refresh cookie restores the session after reloads and silently renews
expired access tokens before retrying a request once. Concurrent requests share
one renewal attempt. Network failures show an error without discarding the
session; a genuinely expired session returns to login with an explanation.
Sign-out clears the refresh cookie and browser state. Signed tokens remain valid
until expiration; changing a password invalidates previous refresh tokens.
No credentials or access tokens are stored in localStorage.

The API enforces permissions even if browser controls are altered.

The default API URL is `http://localhost:3001/api/v1`. To change it, copy `.env.example`
to `.env.local`, set `NEXT_PUBLIC_API_URL`, and restart the frontend (rebuild for
production). Set the API's `WEB_ORIGIN` to the frontend origin for CORS.
Never put JWT_SECRET or database credentials in frontend environment variables.

Reusable UI lives in `components/`: navbar, sidebar, footer, brand, theme switch,
notification bell, and shared financial/settings panels. Page-specific content
lives in `features/pages/`, with a `layout.tsx` and `page.tsx` for each screen:
login, workspace, clients, team, invoices, expenses, retainers, access,
edit-profile, and change-password. The login screen includes the organization
creation flow and preserves its animated form switch.

`app/` owns Next.js App Router entry points and global styling. `app/page.tsx` delegates to the reused `features/pages/workspace/dashboard-entry.tsx`
session boundary. `/invoices` and `/invoices/new` are real App Router routes; new
invoice components, API helpers, hooks, validation and types live in `features/invoices/`.
`features/pages/` is deliberately nested: a root `pages/` would activate Next.js
Pages Router and create unintended routes. These screen files are ordinary React
components; their layouts are composed explicitly and are not automatic routes.

HTTP helpers and response types live in `lib/api.ts`; navigation metadata is in
`lib/navigation.ts`.
Styling uses CSS in `app/globals.css` and the existing local Geist font.

Validation: frontend build, lint, and type checks, plus Chrome tests against a
throwaway database for signup/login, client create/edit, team creation, role changes,
viewer restrictions, organization isolation, financial empty states, and mobile layout.
