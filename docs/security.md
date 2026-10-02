# Security

Baseline: [OWASP Top 10:2025](https://top10.owasp.org/2025/). The control matrix per category lives in
PLAN.md §5.1. Every phase ends with a review of the categories it touches, recorded under `### Security` in
CHANGELOG.md.

## What is in place

- **nuxt-security** (`nuxt.config.ts` → `security`): secure headers (HSTS, `X-Frame-Options`, `nosniff`,
  COOP/CORP/COEP, Permissions-Policy), CSP with per-request nonces, request size limits, XSS validator,
  `X-Powered-By` removed, global rate limit (1000 req / 5 min per IP).
- **Env validation** (`server/utils/env.ts`, `server/plugins/env.ts`): `runtimeConfig` parsed with Zod at startup.
  With `NUXT_STRICT_ENV=true` (default) missing production secrets abort startup. Skipped in `nuxt dev` and prerender.
- `GET /api/health` returns only `{ "status": "ok" }`.
- **Auth (Phase 4)**: sealed session cookies (`nuxt-auth-utils`, scrypt password hashing); password
  reset/API tokens stored as SHA-256 hashes (`server/utils/token.ts`); generic login errors, always-200
  forgot-password (no user enumeration); a password change invalidates every other session
  (`server/plugins/auth-session.ts`); stricter rate limit on `/api/auth/**` (`routeRules`); ownership
  checks via `requireShopOwner`/`requireApiToken` (`server/utils/auth.ts`).
- **CSRF (Phase 14)**: `SameSite=Lax` session cookie plus `server/middleware/csrf.ts`: any non-GET/HEAD/OPTIONS
  `/api/**` request whose `Origin` (or `Referer`) is another host gets 403. Skipped for `Authorization: Bearer`
  calls and the signed Stripe webhook; requests with neither header (non-browser clients) pass, since they can't
  carry a victim's cookies. Keep GET handlers free of side effects so Lax top-level navigations stay harmless.
- **Security logs (A09)**: `logSecurityEvent()` (`server/utils/security-log.ts`) writes one JSON line per
  `login.succeeded|failed`, `password_reset.requested|completed`, `password.changed`, `csrf.refused` to stdout
  (ids, reason, client IP; never emails, passwords, tokens). Admin actions stay in `audit_logs`.
- **Client IP**: taken from `X-Real-IP`, set by the production reverse proxy (docs/infra-and-setup.md). Per-route
  rate limits: auth 30/5min, password change 10/15min, contact 5/15min, checkout 20/15min, global 1000/5min.

## Rules for every change

- **Access control (A01)**: every protected handler calls an auth helper; check ownership of every id it receives.
  Add an integration test proving another user gets 403/404.
- **Input (A05)**: validate body, query and params with shared Zod schemas; Drizzle query builder only; no `v-html`
  with user content.
- **Secrets (A04)**: never log tokens, passwords, cookies or Stripe secrets; store tokens hashed; secrets only in
  server `runtimeConfig` (never under `public`).
- **Errors (A10)**: throw `createError` with a safe `statusMessage`; never return stack traces or SQL errors.
- **Dependencies (A03)**: add only approved libraries (PLAN.md §2), pin versions, commit `bun.lock`.
- **Per-route rate limits** for auth, checkout and contact via `routeRules` → `security.rateLimiter`.
- A CSP violation shows up as a console error; the smoke suite fails on console errors, so keep it green.

## Residual risks (accepted for v1)

- No MFA or admin step-up authentication.
- Deploys pull a version tag, not an image digest (tags are mutable; only the release workflow can write the registry).
- Stock isn't reserved between checkout and payment; the last unit can oversell (stock is clamped at 0).
- The CSP allows `style-src 'unsafe-inline'` for Nuxt UI.
- The per-token API rate limit is per process (move to shared storage if the app scales out).
- `bun audit`: dev-only/unreachable advisories (esbuild dev server; an AI-SDK transitive never called).
- Without the reverse proxy setting `X-Real-IP`, rate limits collapse to one bucket per route.
- Separate charges and transfers: the platform balance must cover refunds before reversals settle.
