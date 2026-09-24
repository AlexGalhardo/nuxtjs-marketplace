# Testing (planned — Phase 1.4, then every phase)

| Kind | Tool | Location | What |
|------|------|----------|------|
| Unit | Vitest (node env) | `tests/unit/` | Pure functions in `shared/` and `server/utils/` (pricing, money, schemas) |
| Component | Vitest + `@nuxt/test-utils` (nuxt env) | `tests/unit/components/` | Vue components with `mountSuspended` |
| Integration | Vitest + `@nuxt/test-utils/e2e` (`setup`, `$fetch`) | `tests/integration/` | API endpoints against a real DB (SQLite and Postgres in CI) |
| Smoke | Playwright (`@smoke` tag) | `tests/smoke/` | Every page returns 200 and renders its main heading; runs after build/deploy |
| E2E | Playwright via `@nuxt/test-utils/playwright` | `tests/e2e/` | Full journeys: signup/login, sell, buy (Stripe test card), refund, admin |

## Rules

- Each feature ships with tests at the appropriate levels; bugs get a regression test.
- Stripe in tests: unit/integration mock the SDK and sign webhook payloads with
  `stripe.webhooks.generateTestHeaderString`; e2e uses test-mode keys when available (skipped otherwise).
- Emails: without `RESEND_API_KEY` they are captured in memory/console; tests assert on the captured payload.
- Use `data-testid` only when role/label selectors are not possible.

## Commands (to be added)

`bun run test:unit`, `bun run test:integration`, `bun run test:smoke`, `bun run test:e2e`, `bun run test`.
