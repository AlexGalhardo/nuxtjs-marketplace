# Testing

| Kind | Tool | Location | What |
|------|------|----------|------|
| Unit | Vitest project `unit` (node env) | `tests/unit/` | Pure functions in `shared/` and `server/utils/` (env, pricing, money, schemas). Use relative imports. |
| Component | Vitest project `nuxt` (nuxt env) | `tests/nuxt/` | Vue components/composables with `mountSuspended` from `@nuxt/test-utils/runtime`; `~` aliases work |
| Integration | Vitest project `integration` + `@nuxt/test-utils/e2e` | `tests/integration/` | Builds the app once per file and calls the real server with `$fetch`/`fetch` (DB-backed from Phase 3; SQLite and Postgres in CI). Files share the on-disk NuxtHub dir (`.data`) and SQLite file, so `fileParallelism: false` runs them sequentially — a DB-backed test expects `bun run db:migrate && bun run db:seed` to have already run |
| Smoke | Playwright project `smoke` | `tests/smoke/` | Every page loads, hydrates, shows its `h1` and logs **no console errors** (catches CSP violations) |
| E2E | Playwright project `e2e` via `@nuxt/test-utils/playwright` | `tests/e2e/` | Full user journeys: signup/login, sell, buy (Stripe test card), refund, admin |

## Commands

| Command | Notes |
|---------|-------|
| `bun run test:unit` | `unit` + `nuxt` projects (fast, also run on pre-push) |
| `bun run test:integration` | Builds Nuxt (~2–3 min); run on pre-push |
| `bun run test:smoke` / `bun run test:e2e` | Playwright; builds then starts the server on port 3100 (`E2E_PORT`). With `PLAYWRIGHT_SKIP_BUILD=1` it reuses the existing `.output` |
| `bun run test:coverage` | Coverage for `shared/` and `server/utils/` |
| `bun run test` | Everything |

First time only: `bunx playwright install chromium`.

## Rules

- Each feature ships with tests at the appropriate levels; bugs get a regression test.
- Test servers run with `NUXT_STRICT_ENV=false` so missing Stripe/Resend secrets are only warnings.
- Name tests by behavior (`'user can switch to dark mode from the header'`), not implementation.
- Prefer role/label selectors (`getByRole`, `getByLabel`); `data-testid` only as a last resort.
- Playwright tests import `test`/`expect` from `@nuxt/test-utils/playwright` and use `goto(path, { waitUntil: 'hydration' })`.
- Stripe: unit/integration mock the SDK and sign webhook payloads with `stripe.webhooks.generateTestHeaderString`;
  e2e uses test-mode keys when available (skipped otherwise).
- Emails: without `NUXT_RESEND_API_KEY` they are captured/logged; tests assert on the captured payload.
