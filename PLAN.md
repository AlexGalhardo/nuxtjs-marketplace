# PLAN.md — Nuxt Marketplace

> Single source of truth for scope, architecture, trade-offs and task order.
> Every agent/session MUST read this file first and tick checkboxes (`[x]`) as work lands.
> Keep the **Decision Log** updated; every change goes to [`CHANGELOG.md`](CHANGELOG.md) ([Keep a Changelog](https://keepachangelog.com/en/1.1.0/)).
> Detailed guides live in [`docs/`](docs/README.md); rules every agent follows live in [`.claude/rules/`](.claude/rules/).

---

## 1. Briefing

A simplified MercadoLivre-style marketplace built to learn **Nuxt** and its ecosystem.

- Any user can **buy** and **sell** **physical** products (Loja Integrada style) and **digital** products (Gumroad style).
- Buyers use a **multi-seller cart** and pay **once** via **Stripe Checkout**; physical items require a shipping address.
- Sellers run a shop at `/my-shop`: branding, products (images, description, price, stock, shipping), orders, refunds, API tokens.
- Sellers also get a **REST API** (Bearer tokens) documented with **Scalar** at `/my-shop/api-docs`.
- **Every financial transaction is logged** in an append-only table.
- Everything (UI, code, comments, URLs, docs) is in **English**.

### Out of scope (v1)
Multi-currency, carrier rate calculation, subscriptions, chat between buyer/seller, OAuth/social login, i18n, mobile apps.

---

## 2. Decision Log (from the grill-me session, 2026-09-24)

| # | Topic | Decision | Trade-off / Notes |
|---|-------|----------|-------------------|
| D1 | Payments model | **Stripe Connect Express**, **separate charges and transfers** | Needed for multi-seller carts (one PaymentIntent, N transfers via `transfer_group`). Platform bears refund/dispute liability first. |
| D2 | Cart | **Multi-seller cart**, order split into `seller_orders` | More complex order model; most MercadoLivre-like. Cart requires login (guest "add to cart" redirects to `/login`). |
| D3 | Platform fee | **10%**, configurable via `NUXT_PLATFORM_FEE_BPS` (basis points, default `1000`) | Fee applied on item subtotal, not on shipping. |
| D4 | Currency | **USD only**, money stored as **integer cents** | No FX logic. |
| D5 | Database | **NuxtHub DB (Drizzle)**, **dual schema** SQLite + PostgreSQL, dialect picked at build time by `NUXT_HUB_DB_DIALECT` (`sqlite`\|`postgresql`) | NuxtHub fixes the dialect at build time and Drizzle needs `sqliteTable` vs `pgTable` → two schema files kept in sync, shared TS types, CI runs integration tests on both. |
| D6 | Auth | **nuxt-auth-utils** (official Nuxt org) | We implement signup/reset/API tokens ourselves on top of sealed-cookie sessions + `hashPassword` (scrypt). |
| D7 | Email | **Resend SDK** (not in Nuxt ecosystem → exception) | Without `RESEND_API_KEY` emails are logged to the console (dev/test). |
| D8 | Digital delivery | Private blob + **expiring signed download links**, download-count limit | Files never publicly routable. |
| D9 | Blob storage | NuxtHub Blob: `fs` driver in local dev, **S3 driver** in docker/prod, **MinIO** in docker-compose | Works with AWS S3 / R2 / any S3-compatible. |
| D10 | Deploy (CD) | Docker image (Bun runtime) pushed to **GHCR** on release tags; deploy via docker compose on any host | Vendor-neutral. |
| D11 | Shipping | **Seller flat rate per physical product**; seller marks shipped + tracking code | No carrier integration. |
| D12 | Seller gate | Draft products anytime; **publishing requires completed Stripe onboarding** (`charges_enabled`) | |
| D13 | Product types | **Seeded fixed list** (`product_types`), each tagged `physical`\|`digital` | Filters stay clean. |
| D14 | REST API auth | **Personal API tokens** (hashed, scoped, revocable) + session cookie | `/my-shop` UI consumes the same `/api/v1/shop/**` endpoints (dogfooding). |
| D15 | Extra v1 scope | **Stock, reviews/ratings, seller refunds, admin role & moderation** | |
| D16 | Git hooks | pre-commit `biome check --staged`; commit-msg `commitlint`; no pre-push hook since 2026-10-02 (CI is the gate) | Owner: faster pushes; failures are caught and fixed from the GitHub Actions run. |
| D17 | TypeScript | **TS 6.0.x**, not 7.x | `vue-tsc@3.3` crashes with TS 7 (`ERR_PACKAGE_PATH_NOT_EXPORTED`). Revisit when vue-tsc supports TS 7. |
| D18 | Validation | **Zod v4** (Standard Schema) shared in `shared/schemas` | Not a Nuxt lib → exception. Works with `UForm` and `readValidatedBody`. |
| D19 | Remote | `origin` = `https://github.com/AlexGalhardo/nuxtjs-marketplace.git` | Agents commit and push themselves (owner, 2026-09-25), following D23. |
| D20 | Security baseline | **nuxt-security** enabled from Phase 1 (headers, nonce CSP, size limits, global rate limit 1000 req/5 min); **OWASP Top 10:2025** review closes every phase (§5.1) | Stricter per-route limits come with auth (Phase 4). |
| D21 | Env validation | Zod-validated `runtimeConfig` at startup; `NUXT_STRICT_ENV` (default `true`) aborts on missing production secrets; skipped in `nuxt dev` and prerender | `NODE_ENV` is inlined at build time by Nitro, so strictness must be a runtime flag. Tests set `NUXT_STRICT_ENV=false`. |
| D22 | Changelog & releases | **Keep a Changelog** in `CHANGELOG.md`; `bun run release <patch\|minor\|major>` (`scripts/release.ts`) cuts versions; GitHub Release notes = that version's section; app version shown in the footer | Replaced `changelogen` (its format isn't Keep a Changelog). PLAN.md no longer keeps a change history (owner, 2026-10-02). |
| D23 | Branches | **`dev` = sandbox, `main` = production**. Push to `dev`; promote the same commits to `main` only after `dev`'s `ci` passes | `main` only ever receives commits CI already validated (owner, 2026-10-02). |
| D24 | Hosting | **Railway** (owner, 2026-10-02): Postgres, S3 bucket, app built from `main` with Wait for CI; SSH `deploy.yml` removed | Managed TLS/edge (`X-Real-IP`), zero-downtime deploys, no server to maintain. GHCR images stay for self-hosters. |
| D25 | Load balancer | **Caddy** (owner, 2026-10-02) instead of nginx for the self-hosted stack | Smaller config, automatic HTTPS when a domain is set, `dynamic a` re-resolves scaled replicas. Railway's own edge balances replicas in production. |

### Non-official libraries (Nuxt ecosystem has no equivalent)

| Library | Why | Status |
|---------|-----|--------|
| `stripe` | Payments (required) | required by brief |
| `resend` | Transactional email | approved (D7) |
| `zod` | Schema validation shared client/server | approved 2026-09-24 |
| `@scalar/api-reference` | API docs UI (Vue) | required by brief |
| `@biomejs/biome`, `husky`, `@commitlint/cli` + `@commitlint/config-conventional` | Lint/format/hooks | required by brief |
| `@playwright/test` | E2E (used through `@nuxt/test-utils/playwright`) | required by brief |
| `nuxt-security` (community module) | Security headers, CSP, rate limiting, CSRF | approved 2026-09-24, enabled in Phase 1 |
| `ioredis` | Redis client for unstorage's redis driver (cache, rate limits) | requested by owner 2026-10-02 (Phase 21) |
| `bullmq` | Job queue on Redis (emails, retries) | requested by owner 2026-10-02 (Phase 21) |
| `@opentelemetry/*` (api, sdk-node, exporters, instrumentations) | Traces/metrics, vendor-neutral | requested by owner 2026-10-02 (Phase 22) |

---

## 3. Architecture

### 3.1 Stack (pinned to latest stable at 2026-09-24)

Bun 1.4.2 (runtime + package manager) · Nuxt 4.5.x · Nuxt UI 4.11.x · Tailwind CSS 4.3.x · NuxtHub core 0.10.x (DB + Blob) · Drizzle ORM · nuxt-auth-utils · @nuxt/image · Stripe · Resend · Zod 4 · Vitest + @nuxt/test-utils · Playwright · Biome 2 · Husky 9 · commitlint · Docker · GitHub Actions.

Official AI tooling for agents: Nuxt MCP (`https://nuxt.com/mcp`), Nuxt UI MCP (`https://ui.nuxt.com/mcp`) in `.mcp.json`; skills in `.claude/skills/` (`nuxt-ui`, `web-design-guidelines`, `agent-browser`, `find-skills`).

### 3.2 High-level flow

```
Browser (Nuxt app, Nuxt UI) ──$fetch/useFetch──▶ Nitro server (server/api/**)
                                                   ├─ nuxt-auth-utils (session cookie) / API token (Bearer)
                                                   ├─ Drizzle via NuxtHub DB (SQLite | Postgres)
                                                   ├─ NuxtHub Blob (fs | S3/MinIO)
                                                   ├─ Stripe (Checkout, Connect, Transfers, Refunds)
                                                   └─ Resend (emails)
Stripe ──webhook──▶ /api/stripe/webhook ──▶ stripe_events (idempotency) + transaction_logs (append-only)
```

### 3.3 Folder structure (Nuxt 4 conventions — see `docs/folder-structure.md`)

```
app/            pages, layouts, components, composables, middleware, assets, app.config.ts
server/         api/ (REST), routes/ (non-/api), middleware/, utils/ (auto-imported), db/ (schemas, migrations, seed), plugins/, tasks/
shared/         types/, schemas/ (zod), utils/ (money, slug) — auto-imported by app + server
tests/          unit/, integration/, smoke/, e2e/
docs/           agent-oriented documentation (markdown)
infra/          docker/ (Dockerfile), docker-compose*.yml
setups/         6 setup shell scripts
.github/        workflows/ (CI/CD)
```

### 3.4 Data model (both dialects)

- `users` (id, email ⓤ, name, password_hash, role `user|admin`, phone, created_at, updated_at)
- `addresses` (user_id, full_name, line1, line2, city, state, postal_code, country, phone, is_default)
- `password_reset_tokens` (user_id, token_hash, expires_at, used_at)
- `api_tokens` (user_id, shop_id, name, prefix, token_hash, scopes, last_used_at, expires_at, revoked_at)
- `shops` (owner_id ⓤ, slug ⓤ, name, description, logo_path, banner_path, stripe_account_id, charges_enabled, payouts_enabled, status `active|suspended`)
- `product_types` (slug ⓤ, name, kind `physical|digital`) — seeded
- `products` (shop_id, product_type_id, kind, title, slug ⓤ, description, price_cents, shipping_cents, stock?, status `draft|published|archived|suspended`, rating_avg, rating_count)
- `product_images` (product_id, blob_path, alt, position)
- `product_files` (product_id, blob_path, filename, size, content_type) — private
- `cart_items` (user_id, product_id, quantity) ⓤ(user_id, product_id)
- `orders` (buyer_id, status `pending|paid|partially_refunded|refunded|canceled|expired`, subtotal/shipping/fee/total cents, currency, stripe_checkout_session_id, stripe_payment_intent_id, shipping_address JSON snapshot)
- `seller_orders` (order_id, shop_id, status `pending|paid|shipped|delivered|refunded|canceled`, subtotal, shipping, fee, payout cents, stripe_transfer_id, carrier, tracking_code, shipped_at)
- `order_items` (seller_order_id, product_id, title/price snapshot, quantity, kind)
- `download_grants` (order_item_id, buyer_id, product_file_id, download_count, max_downloads, expires_at)
- `reviews` (product_id, buyer_id, order_item_id, rating 1-5, comment) ⓤ(product_id, buyer_id)
- `transaction_logs` **append-only** (type, order_id, seller_order_id, shop_id, user_id, stripe_object_id, amount_cents, currency, status, payload JSON, created_at)
- `stripe_events` (stripe event id PK, type, received_at, processed_at, payload)
- `contact_messages` (name, email, subject, message, created_at)
- `audit_logs` (actor_id, action, target_type, target_id, metadata, created_at) — admin moderation

### 3.5 Money flow (Stripe)

1. `POST /api/checkout` → validate cart (stock, published, shop active & `charges_enabled`) → create `orders` + `seller_orders` + `order_items` (status `pending`) → Stripe Checkout Session (platform account, `payment_intent_data.transfer_group = order.id`, shipping address collected in-app beforehand) → log `checkout.created`.
2. Webhook `checkout.session.completed` (idempotent via `stripe_events`) → mark paid, decrement stock, create one **Transfer** per seller (`subtotal + shipping − fee`, `source_transaction = charge`), grant downloads, send emails → log every step.
3. Seller refund → `refunds.create` + `transfers.createReversal` → log.
4. `checkout.session.expired` → order `expired`. `charge.dispute.created`, `account.updated` handled and logged.

---

## 4. Pages

| Route | Access | Notes |
|-------|--------|-------|
| `/` | public | Landing page |
| `/marketplace` | public | Filters: name, min/max price, kind (physical/digital), product type; pagination via query string |
| `/products/[slug]` | public | Gallery, price, shipping, stock, reviews, add to cart |
| `/shops/[slug]` | public | Shop storefront |
| `/cart`, `/checkout`, `/checkout/success` | auth | Address step only when cart has physical items |
| `/orders`, `/orders/[id]` | auth | Buyer orders, downloads, review |
| `/profile` | auth | Personal data (individual), addresses, password change |
| `/my-shop` + `/my-shop/{products,orders,settings,payouts,api-tokens,api-docs}` | auth | Seller area |
| `/admin/**` | admin | Shops, products, users, transaction logs |
| `/contact`, `/terms`, `/privacy` | public | |
| `/login`, `/signup`, `/forget-password`, `/reset-password` | guest | Rules in §6 Phase 4 |

---

## 5. Engineering rules

- Nuxt conventions only (auto-imports, `server/utils`, `useFetch`/`$fetch`, route middleware, `definePageMeta`, `shared/`). No custom architectural patterns (no repositories/DI containers).
- Latest **stable** versions, pinned with `^x.y.z` (never `latest`).
- **Conventional Commits** + **SemVer**. `CHANGELOG.md` follows Keep a Changelog; `bun run release <patch|minor|major>` cuts a version (docs/git-workflow.md).
- Every phase ships with tests (unit + integration; e2e for user-facing flows). No phase is "done" with a red CI.
- Run the `web-design-guidelines` skill on every new page/component batch before closing a UI task.
- Unsupported-by-Bun issues → fall back to Node/npm **only for that step** and document it here.
- Every phase closes with an **OWASP Top 10:2025 review** (§5.1) recorded under `### Security` in CHANGELOG.md.

### 5.1 Security checklist — OWASP Top 10:2025 (https://top10.owasp.org/2025/)

Run this list at the end of every phase (items the phase touches) and fully in Phase 14.

| ID | Category | Controls in this project | Phases |
|----|----------|--------------------------|--------|
| A01 | Broken Access Control | Deny by default; `requireUser`/`requireShopOwner`/`requireAdmin` on every protected handler; ownership checks on every resource id; API token scopes; private blob files only via signed links; integration tests for "other user's resource → 403/404" | 4, 6, 9, 10, 11 |
| A02 | Security Misconfiguration | nuxt-security headers + nonce CSP; strict env validation (D21); no stack traces/versions in responses; `/api/health` reveals nothing; non-root production Docker image; devtools disabled in prod | 1, 2, 13, 14 |
| A03 | Software Supply Chain Failures | Pinned versions + committed `bun.lock`; `bun install --frozen-lockfile` in CI; dependency audit + Renovate/Dependabot; only approved libs (§2); skills reviewed before install; GitHub Actions pinned by SHA | 1, 13 |
| A04 | Cryptographic Failures | scrypt password hashing (nuxt-auth-utils); sealed session cookies (`Secure`, `HttpOnly`, `SameSite=Lax`); reset/API tokens stored as SHA-256 hashes; HTTPS + HSTS in prod; no secrets in logs or client bundle | 4, 10, 14 |
| A05 | Injection | Drizzle parameterized queries only (no interpolated raw SQL); Zod validation for every body/query/param; Vue auto-escaping, no `v-html` with user content; nuxt-security XSS validator | 3–11 |
| A06 | Insecure Design | Threat model per money flow (§3.5); server recomputes prices/fees; idempotent webhooks; rate limits on auth, checkout and contact; abuse cases in tests | 4, 8, 9 |
| A07 | Authentication Failures | Password policy (8–32, mixed classes); generic login errors; rate limiting + no user enumeration on forgot-password; single-use expiring reset tokens; sessions invalidated on reset | 4 |
| A08 | Software or Data Integrity Failures | Stripe webhook signature verification; append-only `transaction_logs`/`audit_logs`; release artifacts built from tagged commits; deploy by Docker image digest | 8, 11, 13 |
| A09 | Security Logging and Alerting Failures | `transaction_logs`, `audit_logs`, auth events (failed login, reset requested) logged without secrets/unneeded PII; admin can review logs | 4, 8, 11 |
| A10 | Mishandling of Exceptional Conditions | `createError` with safe messages; global error page; failed Stripe calls leave orders consistent (no transfer without a log row); fail closed on auth errors; fail fast on bad config | 1, 8, 9 |

---

## 6. Phases, task groups and micro-tasks

Legend: `[x]` done · `[ ]` todo · `[~]` in progress · `[-]` dropped (say why inline)

### Phase 0 — Briefing & research ✅
- **0.1 Research**
  - [x] Find official Nuxt harnesses/skills/MCPs (Nuxt MCP, Nuxt UI MCP, `nuxt/ui` skill; community `onmax/nuxt-skills` noted, not installed)
  - [x] Check latest stable versions of all planned packages
  - [x] Validate NuxtHub DB/Blob capabilities (dialect fixed at build time → D5)
- **0.2 Grill-me session**
  - [x] 4 rounds / 16 questions answered → Decision Log D1–D19
- **0.3 Agent tooling**
  - [x] Install skills: `web-design-guidelines`, `nuxt-ui`, `find-skills`, `agent-browser` (`.claude/skills`, `skills-lock.json`)
  - [x] Add `.mcp.json` with Nuxt + Nuxt UI MCP servers
- **0.4 Bootstrap**
  - [x] Scaffold Nuxt 4.5 with Nuxt UI template via `bunx create-nuxt` (Bun, no pnpm/ESLint leftovers)
  - [x] Pin dependency versions; TS 6 (D17)
  - [x] `PLAN.md`, `docs/`, `CLAUDE.md` = `AGENTS.md`, `README.md`
  - [x] `git init`, add `origin`, first commit

### Phase 1 — Foundation & tooling ✅
- **1.1 Lint/format**
  - [x] Add Biome 2.5 (`biome.json`: 2 spaces, single quotes, no semicolons, full Vue support via `html.experimentalFullSupportEnabled`, Tailwind directives; force-ignore `.nuxt`, `.output`, `.data`, migrations, third-party skills)
  - [x] Scripts: `lint`, `lint:fix`, `format`, `check`, `check:fix`
  - [x] Format the whole codebase once; replace the template's Nuxt SVG logo with an accessible text logo (a11y lint)
- **1.2 Git hooks (D16)**
  - [x] Husky 9 `prepare` script
  - [x] `pre-commit`: `bunx biome check --staged --no-errors-on-unmatched --files-ignore-unknown=true`
  - [x] `commit-msg`: commitlint (`@commitlint/config-conventional`, header ≤ 72, scope-enum as warning)
  - [-] `pre-push`: `typecheck` + `test:unit` + `test:integration` (removed 2026-10-02: CI is the gate)
- **1.3 Runtime config, env & security baseline**
  - [x] `.env.example` with every current variable (documented in `docs/environment-variables.md`)
  - [x] Typed `runtimeConfig`; Zod validation at startup (`server/utils/env.ts` + `server/plugins/env.ts`, D21)
  - [x] `nuxt-security` baseline (D20); `GET /api/health`
- **1.4 Test harness**
  - [x] Vitest 5 + `@nuxt/test-utils` 4 projects: `unit` (node), `nuxt` (nuxt env), `integration` (built server)
  - [x] Playwright via `@nuxt/test-utils/playwright`; `smoke` and `e2e` projects; server on port 3100
  - [x] First passing tests of each kind: env validation (unit), `AppLogo` (nuxt), health + security headers (integration), pages render without console/CSP errors (smoke), color mode toggle (e2e)
- **1.5 Versioning**
  - [x] `release` script + `CHANGELOG.md` (changelogen at first; replaced by `scripts/release.ts` + Keep a Changelog in Phase 15)
- **1.6 OWASP review**
  - [x] A02 (secure headers, strict env validation, health endpoint leaks nothing), A03 (lockfile committed, pinned versions, skills reviewed), A10 (fail-fast startup on bad config)

### Phase 2 — Infrastructure & setup scripts ✅
- **2.1 Docker**
  - [x] `infra/docker/Dockerfile` (multi-stage, `oven/bun:1.4.2`, non-root, healthcheck)
  - [x] `infra/docker-compose.yml` (app + postgres + minio + stripe-cli for webhook forwarding)
  - [x] `infra/docker-compose.dev.yml` (only postgres + minio + stripe-cli, app runs on host)
  - [x] `.dockerignore`
- **2.2 Setup scripts (`setups/`)** — each: checks prerequisites, creates `.env`, installs deps, prepares DB (migrate + seed), prints next steps; idempotent
  - [x] `setup-unix-using-sqlite.sh`
  - [x] `setup-unix-using-postgres-local.sh`
  - [x] `setup-unix-using-postgres-with-docker.sh`
  - [x] `setup-windows-using-sqlite.sh` (Git Bash)
  - [x] `setup-windows-using-postgres-local.sh` (Git Bash)
  - [x] `setup-windows-using-postgres-with-docker.sh` (Git Bash + Docker Desktop)
  - [x] ShellCheck them in CI — done in Phase 13 (`ci.yml` → `shellcheck -x setups/*.sh`, clean)
- **2.3 Docs** — [x] `docs/infra-and-setup.md` updated with real commands

### Phase 3 — Data layer ✅ (admin/demo seed data deferred to Phase 4)
- **3.1 NuxtHub DB**
  - [x] Install `@nuxthub/core`, `drizzle-orm`, `drizzle-kit` (+ `@libsql/client`, `postgres` drivers, `aws4fetch` for blob S3); `hub.db` dialect from `NUXT_HUB_DB_DIALECT` (D5)
  - [x] Verified NuxtHub natively globs `server/db/schema.ts` + `server/db/schema.${dialect}.ts` — no fallback needed
  - [x] `server/db/schema.sqlite.ts` + `server/db/schema.postgresql.ts` (all 19 tables §3.4)
  - [x] Shared inferred types in `shared/types/db.ts`; `tests/unit/db-schema-parity.test.ts` asserts both schemas expose identical tables/columns/nullability
- **3.2 Migrations & seed**
  - [x] Generated migrations for both dialects (`server/db/migrations/{sqlite,postgresql}`)
  - [x] Seed script (`server/db/seed.ts`, run via `bun run db:seed`) — product types (D13) always, idempotent via `onConflictDoNothing()`. **Not** a Nitro task: `nitro task run` requires an already-running dev server, which doesn't fit idempotent one-shot setup scripts (documented in docs/database.md). Admin user + demo shops/products deferred to Phase 4 (needs `nuxt-auth-utils` password hashing)
  - [x] Scripts: `db:generate`, `db:migrate`, `db:seed`, `db:reset`
- **3.3 Blob**
  - [x] `hub.blob: true` — auto-detects `fs` driver (dev) / `s3` driver when `S3_ACCESS_KEY_ID`+`S3_SECRET_ACCESS_KEY`+`S3_BUCKET` are set (docker-compose/prod)
  - [x] `server/routes/images/[...pathname].get.ts` serving only the public `images/` prefix; private `files/` prefix has no route (Phase 9 adds signed download grants)
- **3.4 Tests** — [x] (Postgres now live-tested: Phase 13 CI matrix, 90/90 from a fresh database) `tests/integration/product-types.test.ts` validates the DB layer end-to-end against SQLite; PostgreSQL migrations verified via `drizzle-kit generate` (SQL inspected) but not live-tested (Docker Desktop wasn't running locally) — full SQLite+Postgres CI matrix lands in Phase 13
- **3.5 OWASP touchpoints (§5.1)** — [x] A05: only Drizzle's parameterized query builder is used (no raw/interpolated SQL anywhere in the schema or seed script); `/api/product-types` has no user input to validate yet

### Phase 4 — Authentication ✅
- **4.1 Server**
  - [x] `nuxt-auth-utils` + `NUXT_SESSION_PASSWORD` (validated in `server/utils/env.ts`, ≥32 chars)
  - [x] `POST /api/auth/signup` (name 4–24, email, password 8–32 + lowercase + uppercase + digit + special)
  - [x] `POST /api/auth/login`, `POST /api/auth/logout`
  - [x] `POST /api/auth/forgot-password` (always 200, token hashed, 1h expiry, email via Resend/console)
  - [x] `POST /api/auth/reset-password` (single-use token, invalidates sessions)
  - [x] Rate limit auth endpoints (30/5min per IP, `routeRules`); generic error messages (no user enumeration)
  - [x] `server/utils/auth.ts`: `requireUser`, `requireAdmin`, `requireShopOwner`, `requireApiToken` — `requireUser` also carries the password-change session-invalidation check (nuxt-auth-utils' `fetch` session hook only fires for its own client-facing session route, not for `requireUserSession()` in our handlers — verified in its source, documented in `server/plugins/auth-session.ts`)
- **4.2 UI**
  - [x] `/login` (password eye toggle via `UAuthForm`, "Don't have an account? Sign up")
  - [x] `/signup` (live password rule checklist, "Already have an account? Log in")
  - [x] `/forget-password`, `/reset-password?token=`
  - [x] Route middleware `auth` / `guest` / `admin`; header user menu (`app/layouts/default.vue`)
- **4.3 Profile** — [x] `/profile` personal data, addresses CRUD (with delete confirmation), change password
- **4.4 Tests** — [x] unit (password/address/profile schemas), integration (auth + profile endpoints, ownership checks), e2e (signup → logout → login → reset → login)
- **4.5 UI audit** — [x] `web-design-guidelines` run on all new pages/layouts; fixed: missing `autocomplete` on every password/email/name field, missing page `<h1>` (auth pages use a visually-hidden one, `UAuthForm`'s title isn't one), vague "Continue" submit labels → "Log in"/"Create account", delete-address had no confirmation (added a confirm modal), a few straight apostrophes
- **4.6 OWASP touchpoints (§5.1)** — [x] A04 (scrypt hashing, sealed `Secure`/`HttpOnly`/`SameSite=Lax` cookies verified via response headers, reset tokens as SHA-256 hashes), A07 (password policy, generic login/forgot-password responses, single-use expiring reset tokens, password change invalidates other sessions), A01 (ownership test: another user's address → 404), A06 (rate limit + abuse-case tests: wrong password, duplicate signup, reused reset token)

### Phase 5 — UI shell & static pages ✅
- [x] App layout (`UHeader`, `UFooter`, nav, color mode), `default` / `auth` / `dashboard` layouts
- [x] Brand theme in `app.config.ts` + Tailwind v4 tokens in `main.css`
- [x] Landing page `/` (hero, categories, featured products, how selling works, CTA)
- [x] `/contact` (form → `contact_messages` + email), `/terms`, `/privacy`
- [x] `error.vue`, SEO meta defaults, `robots`/sitemap-ready
- [x] web-design-guidelines audit + e2e smoke for each page

### Phase 6 — Shops & products (seller) ✅
- **6.1 Shop**
  - [x] Create shop (name, slug, description, logo, banner) at `/my-shop` (`/my-shop`, `/my-shop/settings`)
  - [x] Stripe Connect Express onboarding (`/my-shop/payouts` + `/payouts/return` + `/payouts/refresh`: account link, `POST /api/v1/shop/stripe/onboarding`, `POST /api/stripe/webhook` handles `account.updated` → `chargesEnabled`/`payoutsEnabled`, idempotent via `stripe_events`)
- **6.2 Products** (`/api/v1/shop/products/**`, consumed by UI)
  - [x] CRUD with draft/published/archived; publishing gated by D12 (`charges_enabled` check, 409 until onboarded)
  - [x] Image upload (multiple, reorder, alt text, type/size validation) → public blob (`/my-shop/products/[id]/edit`)
  - [x] Digital file upload → private blob (digital products only, 400 for physical)
  - [x] Stock + shipping fee for physical products (server derives `kind`/nulls `stock`/zeroes `shippingCents` for digital, never trusts the client)
- **6.3 Tests** — [x] integration for every endpoint (owner vs non-owner: 401/403/404 cases for shop, products, images, files, branding); [x] e2e create shop → create product → publish (was blocked by a dashboard hydration id mismatch, fixed in Phase 11)

### Phase 7 — Marketplace & catalog (public)
- [x] `GET /api/products` with filters (q, minPrice, maxPrice, kind, type, sort, page) — validated query
- [x] `/marketplace` with `UInput`, price range, `USelect`s, synced to URL query, `UPagination`
- [x] `/products/[slug]` (gallery, reviews summary, add to cart — rendered disabled until the Phase 8 cart exists), `/shops/[slug]`
- [x] Tests: filter unit tests, integration, e2e browse & filter

### Phase 8 — Cart, checkout & payments
- [x] Cart API + `useCart` composable; header cart badge
- [x] `/checkout` address step (physical only) → Stripe Checkout Session (D1)
- [x] `POST /api/stripe/webhook`: signature check, idempotency, handlers (§3.5)
- [x] Transfers per seller, stock decrement (transactional), download grants
- [x] `transaction_logs` written for every money event (helper `logTransaction`)
- [x] Order confirmation emails (buyer + each seller)
- [x] Tests: fee/split math unit tests, webhook integration tests with signed test payloads, e2e checkout (against the fake Stripe API — no real test-mode keys in this environment yet; a real test-card run is a Phase 12 item)

### Phase 9 — Post-purchase ✅
- [x] Buyer `/orders`, `/orders/[id]`, signed download links (D8)
- [x] Seller `/my-shop/orders`: mark shipped (carrier + tracking), delivered
- [x] Seller refunds (full) → refund + transfer reversal + logs (D15)
- [x] Reviews (only verified buyers, one per product) + rating aggregates
- [x] Tests for each flow (unit: order schemas; integration: `orders.test.ts`; e2e: `checkout.spec.ts` extended through review + seller shipping)

### Phase 10 — Public REST API & docs ✅
- [x] API tokens UI (`/my-shop/api-tokens`): create (shown once), scopes, revoke
- [x] Bearer auth in `requireApiToken`; per-token rate limit
- [x] Nitro OpenAPI (`nitro.experimental.openAPI`) + `defineRouteMeta` on every `/api/v1/**` route
- [x] `/my-shop/api-docs` renders Scalar (`@scalar/api-reference`) client-only
- [x] Tests: token auth integration, OpenAPI snapshot test (plus unit: token schema; e2e: `api-tokens.spec.ts`)

### Phase 11 — Admin & moderation ✅
- [x] `/admin` dashboard: users, shops (suspend), products (suspend), transaction logs (filters, CSV export)
- [x] `audit_logs` for every admin action
- [x] Tests (unit: admin schemas, CSV; integration: `admin.test.ts`; e2e: `admin.spec.ts`)

### Phase 12 — Quality pass ✅
- [x] Coverage targets: unit ≥ 80% on `shared/` + `server/utils/` (98% measured; thresholds enforced in `vitest.config.ts`)
- [x] Full e2e suite (buyer journey `checkout.spec.ts`, seller `my-shop.spec.ts` + `api-tokens.spec.ts`, admin `admin.spec.ts`) — 15/15 green, 12 consecutive parallel runs without a flake
- [x] Accessibility & UX audit (web-design-guidelines skill) on all pages; fix findings
- [x] Exploratory QA with `agent-browser`

### Phase 13 — CI/CD ✅ (workflows written and linted; first real run happens on the next push — see Developer actions)
- [x] `ci.yml`: install (Bun cache) → Biome CI → typecheck → unit → integration (matrix sqlite/postgres service) → build → smoke → e2e (Playwright report artifact)
- [x] `commitlint.yml` on PR titles/commits
- [x] `release.yml`: on `v*.*.*` tag → changelog → GitHub Release → Docker build & push to GHCR
- [x] `deploy.yml` (manual/dispatch): SSH + `docker compose pull && up -d` (secrets documented)
- [x] Renovate/Dependabot for Bun deps

### Phase 14 — Hardening & launch readiness ✅
- [x] Full OWASP Top 10:2025 audit (§5.1), fix findings, document residual risks (docs/security.md "Residual risks")
- [x] Tighten nuxt-security (CSP review, per-route rate limits, CSRF for cookie-authenticated mutations) — CSRF guard (`server/middleware/csrf.ts`), limits keyed on `X-Real-IP`, password-change limit, CSP reviewed
- [x] Performance (image sizes, caching `routeRules`, DB indexes)
- [x] Final docs pass; `v1.0.0` release

### Phase 15 — Process, docs & versioning (owner request 2026-10-02, items 3–7, 10, 11)
- [x] Remove PLAN.md §7 (risks) and §8 (change history); residual risks → docs/security.md, uploads note → docs/infra-and-setup.md
- [x] CHANGELOG.md in Keep a Changelog format (history folded into `[1.0.0]`) — D22
- [x] `scripts/release.ts` + `release.yml` publishes notes from CHANGELOG via `gh release`; `changelogen` removed
- [x] App version in the footer (`app.config.ts` ← `package.json`), linked to its GitHub release
- [x] `.claude/rules/` (agent workflow, money, server security, frontend, testing)
- [x] CLAUDE.md/AGENTS.md: karpathy-guidelines, ponytail and graphify mandatory
- [x] `bun run setup:{sqlite,postgres-local,postgres-docker}` → `scripts/setup.ts` picks `setups/*-{windows,unix}-*.sh` (Git Bash on Windows)
- [x] graphify graph built (`graphify-out/`, gitignored): 1280 nodes, 115 communities
- [x] Rewrite GitHub Release v1.0.0 notes from the new CHANGELOG section (`gh release edit`)
- **Assert:** `bun run check && bun run typecheck && bun run test:unit` green; `bun run setup:sqlite` reaches "app started"

### Phase 16 — Branch flow dev → main (item 9) — D23
- [x] Create `dev` from `main`, push; `ci.yml` runs on pushes/PRs to `dev` and `main`
- [x] `deploy.yml` refuses any ref but `main`; `release.yml` only on `v*` tags
- [x] Document promotion (`git push origin dev:main` after green `dev` run) in docs/git-workflow.md and `.claude/rules/agent-workflow.md`
- **Assert:** a push to `dev` triggers `ci`; nothing deploys from `dev`

### Phase 17 — Stabilization: deploy, tests, CI (item 8)
- [x] Fix doc contradictions found by graphify: `/my-shop` layout (ui-ux-frontend vs design-system); `server/tasks/` vs seed script (folder-structure vs database)
- [x] Dependabot `bun` job failed (bun.lock v2 unsupported): removed; weekly `deps.yml` reports `bun outdated` + `bun audit`; Actions/Docker PRs target `dev`
- [x] `ci.yml`: job timeouts, new `docker` job builds the image on every push (concurrency cancel, Bun cache, report artifact already there)
- [x] `deploy.yml`: `up --wait` on the healthcheck, automatic rollback to the last good version (`.deployed-version`); `stripe/stripe-cli` pinned to v1.53.0
- [x] Production on Railway (D24): Postgres + bucket + app from `main` with Wait for CI, pre-deploy migrations; smoke: pages 200, `/api/health`, HSTS/CSP. Found and fixed NuxtHub's unsorted migrations (Bun patch)
- [ ] Run the whole suite locally (unit, coverage, integration sqlite+postgres, smoke, e2e); fix flakes/bugs found
- **Assert:** `bun run test` green locally; `ci` green on `dev`; image builds

### Phase 18 — QA / pentest suite in CI (item 2)
- [ ] Load seed `bun run db:seed:load` (1,000 sellers, 10,000 buyers, products, orders; deterministic faker seed, batched inserts, both dialects)
- [ ] `tests/qa/` Playwright project: crawl every page/link/button/form as a human tester (all routes, 390px + desktop, both themes), console/CSP/4xx/5xx = fail
- [ ] Input fuzzing on every form and endpoint: XSS payloads (reflected/stored, rendered escaped), SQL injection, oversize, unicode, negative/float money, enum abuse
- [ ] AuthZ matrix: every `/api/**` route × {guest, buyer, seller, other seller, admin, API token per scope} → expected status
- [ ] Business abuse: price/qty tampering, double submit/double spend (concurrent checkout of last unit), replayed and forged webhooks, refund twice, review without purchase, CSRF, rate limits, path traversal, open redirect
- [ ] Transactions/consistency: money invariants (`transaction_logs` sums = orders), no partial writes after injected failures, dual-dialect parity
- [ ] Emails: capture outbox in tests (reset, order buyer/seller, shipped, refund, contact) and assert recipients/content
- [ ] Load test "black friday": k6-free Bun script (concurrent catalog/search/cart/checkout against the seeded DB), p95 + error-rate thresholds
- [ ] CI job `qa` (needs build) on `dev` and `main`; report artifact; docs/testing.md section
- **Assert:** `bun run test:qa` and `bun run test:load` green locally and in CI

### Phase 19 — Stripe automation (item 1; needs owner login)
- [ ] Owner: `stripe login` (CLI) + Stripe MCP auth
- [ ] Inventory account (test + live): connected accounts, customers, products/prices, webhooks, coupons → show list, owner OKs deletion
- [ ] Delete via API everything deletable; archive the rest; owner clicks "Delete all test data" and removes old sandboxes
- [ ] `scripts/stripe-bootstrap.ts`: idempotent creation of webhook endpoint(s) with the exact event list, Connect settings check, writes keys/secret to `.env`
- [ ] Cover every Stripe case: onboarding incomplete/restricted, `account.updated` deauth, async payments, expired sessions, transfer failure + retry, refund failure, disputes (created/closed), `charge.refunded` from Dashboard, payout failures, idempotent retries
- [ ] Real test-mode run with test cards (success, 3DS, decline, insufficient funds, dispute) via `stripe trigger`/test clocks
- **Assert:** e2e checkout passes against real Stripe test mode locally; fake-Stripe suite green in CI

### Phase 21 — Scale-out: Redis, queues, load balancer (owner request 2026-10-02)
- [x] Redis 8.8 in compose; `server/plugins/redis.ts` mounts `cache` + `#rate-limiter-storage` on unstorage's redis driver at run time, fail-open to memory
- [x] Cache hot reads (catalog, product page, shop page, product types) with `defineCachedEventHandler`: 30 s TTL + SWR instead of invalidation (bounded staleness; checkout re-prices from the DB); bypassed without Redis
- [x] Shared rate limits (nuxt-security limiter + per-token API limit via atomic INCR) in Redis
- [x] BullMQ mail queue (`queueMail`): 5 attempts, exponential backoff, failed set kept; worker in each replica (`QUEUE_WORKER=false` opts out); inline fallback without Redis or when enqueueing fails. Transfer crash window fixed in `fulfillCheckout` instead (re-entrant transfers) — no queue needed
- [x] Load balancer: Caddy (D25) in compose in front of 2+ app replicas (DNS-discovered replicas, passive health, sets `X-Real-IP`, zstd/gzip)
- [-] MongoDB: not added. Every entity here is relational and money needs ACID transactions across tables (Postgres already gives JSONB for loose data). Documented in docs/system-design as a "why not" lesson.
- [ ] Docs: docs/system-design (caching, queues, LB), env vars, infra
- **Assert:** compose stack with 2 replicas behind Caddy passes smoke + QA suite; cache hit ratio visible in metrics; app works with Redis down (degrades to no cache / inline jobs)

### Phase 22 — Telemetry & observability (owner request 2026-10-02)
- [x] OpenTelemetry SDK in a Nitro plugin (`server/plugins/telemetry.ts`): request spans from Nitro hooks continuing `traceparent`, OTLP exporter, off unless `OTEL_*` set. DB/Stripe child spans left as an exercise (docs/observability.md)
- [x] Prometheus metrics on a private `:9464`: request duration histogram (route pattern labels) + money-event counters from `logTransaction()`; queue depth gauge left as an exercise
- [x] `infra/docker-compose.observability.yml`: Tempo, Prometheus (DNS discovery of replicas), Loki + Grafana Alloy (Promtail is deprecated), Grafana with provisioned datasources and dashboard; app exports straight to Tempo (no collector needed)
- [x] docs/observability.md; Railway tracing enabled on `app` in production
- **Assert:** `docker compose --profile observability up` shows a checkout trace in Grafana and the dashboard has live metrics

### Phase 23 — Open source & system design docs (owner request 2026-10-02)
- [x] `docs/system-design/`: requirements, capacity estimates (1k sellers / 10k buyers / black friday), high-level architecture, data model ERD, money flow sequence, caching, queues, LB, observability, failure modes, trade-offs — Mermaid diagrams (render on GitHub)
- [ ] `/system-design` page: interactive Vue Flow diagrams (architecture, request lifecycle, money flow, data model, scaling, observability), linked from the footer (owner request 2026-10-02; `@vue-flow/*` approved)
- [~] README.md rewritten for open source (learning project statement, features, quick start, architecture link); screenshots still to add
- [x] `LICENSE` (MIT), `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, issue/PR templates
- **Assert:** every doc link resolves; Mermaid renders on GitHub

### Phase 24 — Release v1.1.0
- [ ] `[Unreleased]` complete; promote `dev` → `main` after green CI; `bun run release minor` → v1.1.0; release + images published; footer shows v1.1.0

---

## Developer actions (owner to-do)

Things only the owner can do (accounts, keys, external services). Everything else is automated.

- [ ] Promote your own account to admin: sign up on https://app-production-8586.up.railway.app, then run
  `railway ssh --service app -- bun run db:make-admin <your-email>` and log in again.
- [ ] Stripe: `stripe login` + Stripe MCP auth (Phase 19).
