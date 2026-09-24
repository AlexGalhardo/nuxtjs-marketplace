# Security

Baseline: [OWASP Top 10:2025](https://top10.owasp.org/2025/). The control matrix per category lives in
PLAN.md §5.1. Every phase ends with a review of the categories it touches, recorded in PLAN.md Change History.

## What is in place

- **nuxt-security** (`nuxt.config.ts` → `security`): secure headers (HSTS, `X-Frame-Options`, `nosniff`,
  COOP/CORP/COEP, Permissions-Policy), CSP with per-request nonces, request size limits, XSS validator,
  `X-Powered-By` removed, global rate limit (1000 req / 5 min per IP).
- **Env validation** (`server/utils/env.ts`, `server/plugins/env.ts`): `runtimeConfig` parsed with Zod at startup.
  With `NUXT_STRICT_ENV=true` (default) missing production secrets abort startup. Skipped in `nuxt dev` and prerender.
- `GET /api/health` returns only `{ "status": "ok" }`.

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
