# Testing

| Kind | Tool | Location | What |
|------|------|----------|------|
| Unit | Vitest project `unit` (node env) | `tests/unit/` | Pure functions in `shared/` and `server/utils/` (env, pricing, money, schemas). Use relative imports. |
| Component | Vitest project `nuxt` (nuxt env) | `tests/nuxt/` | Vue components/composables with `mountSuspended` from `@nuxt/test-utils/runtime`; `~` aliases work |
| Integration | Vitest project `integration` + `@nuxt/test-utils/e2e` | `tests/integration/` | `tests/integration/global-setup.ts` builds the app **once for the whole project** (not once per file — that was ~20 min across 8 files) and every file calls the real server with `$fetch`/`fetch` (DB-backed from Phase 3; SQLite and Postgres in CI). Files share the test NuxtHub dir (`.data-test`, never the dev `.data`), its SQLite file and that one running server, so `fileParallelism: false` runs them sequentially. The build migrates `.data-test` and the global setup seeds the product types (`SEED_DEMO_CATALOG=false`: no demo catalog) |
| Smoke | Playwright project `smoke` | `tests/smoke/` | Every page loads, hydrates, shows its `h1` and logs **no console errors** (catches CSP violations) |
| E2E | Playwright project `e2e` via `@nuxt/test-utils/playwright` | `tests/e2e/` | Full user journeys: signup/login, sell, buy (Stripe test card), refund, admin |
| QA / pentest | Playwright project `qa` | `tests/qa/` | A professional tester's pass against the load seed: crawl, fuzzing, authZ matrix, abuse, money, mails ([below](#qa--pentest-suite)) |
| Load | Plain Bun script | `tests/load/` | "Black friday": concurrent shoppers, p95 and error-rate thresholds |

## Commands

| Command | Notes |
|---------|-------|
| `bun run test:unit` | `unit` + `nuxt` projects (fast) |
| `bun run test:integration` | Builds Nuxt once for the whole run (~2–3 min), via `tests/integration/global-setup.ts` |
| `bun run test:smoke` / `bun run test:e2e` | Playwright; builds, seeds the product types, then starts the server on port 3100 (`E2E_PORT`), all on `.data-test`. With `PLAYWRIGHT_SKIP_BUILD=1` it reuses the existing `.output` (built with the same `NUXT_HUB_DIR`) |
| `bun run test:coverage` | Coverage for `shared/` and `server/utils/`; fails below 80% (statements, branches, functions, lines). DB/Stripe orchestration modules (`auth`, `cart`, `catalog`, `orders`) are excluded and covered by `test:integration` instead |
| `bun run test` | Everything |

First time only: `bunx playwright install chromium`.

## Rules

- Tests never write to the dev database: both suites use `NUXT_HUB_DIR=.data-test` (gitignored). External
  services are mocked (`page.route` for ViaCEP, the fake Stripe API for payments).

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

## QA & pentest suite

The last guardrail before production (CI job `qa`): it behaves like a professional tester and pentester against
a production build and a realistic database, then load-tests the same build.

**Data.** `bun run db:seed:load` (`server/db/seed-load.ts`) adds 1,000 sellers (charges-enabled shop, published
products of every type, physical and digital), 10,000 buyers (one address each), ~4,000 cart lines, 3,000 paid
orders with their `transaction_logs`, and reviews. Deterministic (fixed faker seed), batched inserts in one
transaction, SQLite and Postgres, idempotent (skips when `admin@load.resell.sh` exists), ~10 s on SQLite. Every
account logs in with `Load123!` (hashed once). Buyers 1–2,000 have a cart, 2,001–5,000 one paid order, the rest
start empty (the load test logs in as those).

**What `tests/qa/` covers.**

| File | What a tester checks |
|------|----------------------|
| `crawl.spec.ts` | Every page under `app/pages` (a new page is crawled automatically and fails until it gets a role) as guest, buyer, seller and admin, at 390 px and desktop, light and dark: no console error, no CSP violation, no 4xx/5xx from our origin, exactly one `h1`, no sideways scroll. Then every link is fetched and every button that doesn't destroy data is clicked |
| `fuzz.spec.ts` | Every field of every form endpoint with hostile values (XSS, SQL injection, oversize, unicode/RTL/zero-width, null bytes, wrong types, broken JSON, 3 MB bodies): always a 4xx with a safe message, never a 5xx or a leaked stack/SQL. Money fields, enums and mass assignment. Stored and reflected XSS render as text (no script runs, no dialog). UI forms with hostile input |
| `authz.spec.ts` | Every route under `server/api` (read from the file system; a new route fails until classified) × guest, buyer, seller, admin and an API token per scope → the expected status class. IDOR on products, orders, addresses, order items and tokens |
| `abuse.spec.ts` | Price/quantity tampering, buying from your own shop, concurrent checkout of the last unit (stock never negative), unsigned/forged/tampered/stale/replayed webhooks, double refund, reviews without a purchase, CSRF, rate limits (login, contact, checkout), path traversal on `/images` and `/downloads`, open redirect on `?redirect` |
| `money.spec.ts` | Payouts + platform fee == amount paid, every money event logged, ledger invariants over **every** paid order in the database, no partial writes after an injected Stripe failure (fake Stripe: `acct_fail` transfers, `refund_fail` refunds) |
| `emails.spec.ts` | Reset, order (buyer and every seller), shipped, refund and contact mails reach the right people, and only them |

Mails: with `MAIL_OUTBOX_FILE` set (only the Playwright `webServer` sets it) and no Resend key, `sendMail` also
appends each mail as a JSON line to `.data-test/mail-outbox.jsonl`; `outbox(to)` in `tests/qa/helpers.ts` reads it.
Every QA client sends its own `X-Real-IP` (the app keys rate limits on it), so per-IP limits behave like real traffic.

**Run locally.**

```bash
bun run test:qa                           # build, product types + load seed, server on :3100, the suite
PLAYWRIGHT_SKIP_BUILD=1 bun run test:qa   # reuse an .output built with NUXT_HUB_DIR=.data-test
bun run test:load                         # .output on :3102 with the fake Stripe, then the load test
```

`test:load` knobs: `LOAD_VUS` (40), `LOAD_DURATION_S` (60), `LOAD_THINK_MS` (1000), `LOAD_P95_MS` (1500),
`LOAD_MAX_ERROR_RATE` (0.01), `LOAD_BASE_URL` (test a running server instead). Each virtual user logs in as its
own seeded buyer with its own `X-Real-IP`, browses home, catalog, search and product pages, adds to cart (30%),
checks out and pays (8%). The summary (RPS, p50/p95/p99, error rate, per endpoint) is printed and written to
`load-summary.json` (uploaded with the Playwright report when the CI job fails).

**Add a case.** Reuse the fixtures in `tests/qa/helpers.ts` (`makeSeller`, `listProduct`, `makeBuyer`,
`checkout`, `pay`, `signedWebhook`, `dbQuery`, `outbox`) and import `test`/`expect` from there (it gives every
test its own client IP). Fresh users per test, never the seeded accounts the crawl uses. New page: give it a role
in `crawl.spec.ts` (`roleOf`/`concrete`). New API route: classify it in `authz.spec.ts` (`accessOf`). A real bug
found by the suite is fixed at the root and the failing case stays as its regression test.

Known, not fixed: right after a failed submit, a click on Nuxt UI's `UAuthForm` within its 300 ms input-validation
debounce is dropped (no request, no message; a second click works). The fuzz test leaves the field first, as a
person does.
