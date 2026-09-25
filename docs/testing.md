# Testing

| Kind | Tool | Location | What |
|------|------|----------|------|
| Unit | Vitest project `unit` (node env) | `tests/unit/` | Pure functions in `shared/` and `server/utils/` (env, pricing, money, schemas). Use relative imports. |
| Component | Vitest project `nuxt` (nuxt env) | `tests/nuxt/` | Vue components/composables with `mountSuspended` from `@nuxt/test-utils/runtime`; `~` aliases work |
| Integration | Vitest project `integration` + `@nuxt/test-utils/e2e` | `tests/integration/` | `tests/integration/global-setup.ts` builds the app **once for the whole project** (not once per file — that was ~20 min across 8 files) and every file calls the real server with `$fetch`/`fetch` (DB-backed from Phase 3; SQLite and Postgres in CI). Files share the on-disk NuxtHub dir (`.data`), the SQLite file and that one running server, so `fileParallelism: false` runs them sequentially — a DB-backed test expects `bun run db:migrate && bun run db:seed` to have already run |
| Smoke | Playwright project `smoke` | `tests/smoke/` | Every page loads, hydrates, shows its `h1` and logs **no console errors** (catches CSP violations) |
| E2E | Playwright project `e2e` via `@nuxt/test-utils/playwright` | `tests/e2e/` | Full user journeys: signup/login, sell, buy (Stripe test card), refund, admin |

## Commands

| Command | Notes |
|---------|-------|
| `bun run test:unit` | `unit` + `nuxt` projects (fast, also run on pre-push) |
| `bun run test:integration` | Builds Nuxt once for the whole run (~2–3 min), via `tests/integration/global-setup.ts`; run on pre-push |
| `bun run test:smoke` / `bun run test:e2e` | Playwright; builds then starts the server on port 3100 (`E2E_PORT`). With `PLAYWRIGHT_SKIP_BUILD=1` it reuses the existing `.output` |
| `bun run test:coverage` | Coverage for `shared/` and `server/utils/` |
| `bun run test` | Everything |

First time only: `bunx playwright install chromium`.

## Rules

- Each feature ships with tests at the appropriate levels; bugs get a regression test.
- Test servers run with `NUXT_STRICT_ENV=false` so missing Stripe/Resend secrets are only warnings.
- Integration tests boot the **production build**, not `nuxt dev` — nuxt-auth-utils' dev-only
  auto-generated `NUXT_SESSION_PASSWORD` fallback does not apply, so `tests/integration/global-setup.ts`
  passes it (and `NUXT_STRICT_ENV=false`) once for every file; individual test files no longer call
  `setup()` themselves — importing `fetch`/`$fetch` from `@nuxt/test-utils/e2e` is enough, since that
  package recovers the shared server's context from the `NUXT_TEST_CONTEXT` env var the global setup
  exposes.
- Name tests by behavior (`'user can switch to dark mode from the header'`), not implementation.
- Prefer role/label selectors (`getByRole`, `getByLabel`); `data-testid` only as a last resort.
- Playwright tests import `test`/`expect` from `@nuxt/test-utils/playwright` and use `goto(path, { waitUntil: 'hydration' })`.
- Stripe: integration and e2e never call api.stripe.com. `tests/integration/helpers/fake-stripe.ts` is a tiny
  HTTP fake of the endpoints we use (checkout sessions, payment intents, transfers; `acct_fail` makes a
  transfer fail), started by `tests/integration/global-setup.ts` and `tests/e2e/global-setup.ts`; the app
  reaches it through `NUXT_STRIPE_API_BASE`. Tests read what the app sent from `GET /__requests` and sign
  webhook payloads with `stripe.webhooks.generateTestHeaderStringAsync` (secret `whsec_test_integration`).
  Use the **async** Stripe webhook APIs: under Bun, stripe loads its SubtleCrypto build, whose sync
  `constructEvent`/`generateTestHeaderString` always throw. The e2e checkout test intercepts the redirect to
  Stripe’s hosted page with `page.route` and posts the `checkout.session.completed` webhook itself.
- DB assertions in integration tests go through `tests/integration/helpers/db.ts` (`dbQuery`), a subprocess
  using `createSeedClient({ prepare: false })` — never `prepare: true` in tests: parallel `nuxt prepare` runs
  collide on `.nuxt`.
- Emails: without `NUXT_RESEND_API_KEY` they are captured/logged; tests assert on the captured payload.
