# PLAN.md — Nuxt Marketplace

> Single source of truth for scope, architecture, trade-offs and task order.
> Every agent/session MUST read this file first and tick checkboxes (`[x]`) as work lands.
> Keep the **Decision Log** and **Change History** updated. Detailed guides live in [`docs/`](docs/README.md).

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
| D16 | Git hooks | pre-commit `biome check --staged`; commit-msg `commitlint`; pre-push typecheck + unit + integration tests | |
| D17 | TypeScript | **TS 6.0.x**, not 7.x | `vue-tsc@3.3` crashes with TS 7 (`ERR_PACKAGE_PATH_NOT_EXPORTED`). Revisit when vue-tsc supports TS 7. |
| D18 | Validation | **Zod v4** (Standard Schema) shared in `shared/schemas` | Not a Nuxt lib → exception. Works with `UForm` and `readValidatedBody`. |
| D19 | Remote | `origin` = `https://github.com/AlexGalhardo/nuxtjs-marketplace.git` | Never push without the owner's OK. |

### Non-official libraries (Nuxt ecosystem has no equivalent) — approved/pending

| Library | Why | Status |
|---------|-----|--------|
| `stripe` | Payments (required) | required by brief |
| `resend` | Transactional email | approved (D7) |
| `zod` | Schema validation shared client/server | pending confirmation |
| `@scalar/api-reference` | API docs UI (Vue) | required by brief |
| `@biomejs/biome`, `husky`, `@commitlint/cli` + `@commitlint/config-conventional` | Lint/format/hooks | required by brief |
| `@playwright/test` | E2E (used through `@nuxt/test-utils/playwright`) | required by brief |
| `nuxt-security` (community module) | Security headers, rate limiting, CSRF | pending confirmation (Phase 14) |
| `changelogen` (UnJS, used by Nuxt itself) | Semver bump + changelog | ecosystem-aligned |

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
- **Conventional Commits** + **SemVer** (`0.x` until v1 feature-complete). Changelog via `changelogen`.
- Every phase ships with tests (unit + integration; e2e for user-facing flows). No phase is "done" with a red CI.
- Run the `web-design-guidelines` skill on every new page/component batch before closing a UI task.
- Unsupported-by-Bun issues → fall back to Node/npm **only for that step** and document it here.

---

## 6. Phases, task groups and micro-tasks

Legend: `[x]` done · `[ ]` todo · `[~]` in progress · `[-]` dropped (explain in Change History)

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

### Phase 1 — Foundation & tooling
- **1.1 Lint/format**
  - [ ] Add Biome 2 (`biome.json`: 2 spaces, single quotes, no semicolons, Vue/TS/JSON/CSS support; ignore `.nuxt`, `.output`, `.data`, migrations)
  - [ ] Scripts: `lint`, `lint:fix`, `format`, `check`
  - [ ] Format the whole codebase once
- **1.2 Git hooks (D16)**
  - [ ] Husky 9 `prepare` script
  - [ ] `pre-commit`: `bunx biome check --staged --no-errors-on-unmatched`
  - [ ] `commit-msg`: commitlint with `@commitlint/config-conventional`
  - [ ] `pre-push`: `typecheck` + `test:unit` + `test:integration`
- **1.3 Runtime config & env**
  - [ ] `.env.example` with every variable (documented in `docs/environment-variables.md`)
  - [ ] `runtimeConfig` typed; validate required env at startup (`server/plugins/env.ts`)
- **1.4 Test harness**
  - [ ] Vitest 5 + `@nuxt/test-utils` with projects: `unit` (node), `nuxt` (nuxt env), `integration`
  - [ ] Playwright via `@nuxt/test-utils/playwright`; `smoke` and `e2e` projects
  - [ ] First passing tests of each kind (sanity)
- **1.5 Versioning**
  - [ ] `changelogen` config + `release` script; `CHANGELOG.md`

### Phase 2 — Infrastructure & setup scripts
- **2.1 Docker**
  - [ ] `infra/docker/Dockerfile` (multi-stage, `oven/bun:1.4.2`, non-root, healthcheck)
  - [ ] `infra/docker-compose.yml` (app + postgres + minio + stripe-cli for webhook forwarding)
  - [ ] `infra/docker-compose.dev.yml` (only postgres + minio + stripe-cli, app runs on host)
  - [ ] `.dockerignore`
- **2.2 Setup scripts (`setups/`)** — each: checks prerequisites, creates `.env`, installs deps, prepares DB (migrate + seed), prints next steps; idempotent
  - [ ] `setup-unix-using-sqlite.sh`
  - [ ] `setup-unix-using-postgres-local.sh`
  - [ ] `setup-unix-using-postgres-with-docker.sh`
  - [ ] `setup-windows-using-sqlite.sh` (Git Bash)
  - [ ] `setup-windows-using-postgres-local.sh` (Git Bash)
  - [ ] `setup-windows-using-postgres-with-docker.sh` (Git Bash + Docker Desktop)
  - [ ] ShellCheck them in CI
- **2.3 Docs** — [ ] `docs/infra-and-setup.md` updated with real commands

### Phase 3 — Data layer
- **3.1 NuxtHub DB**
  - [ ] Install `@nuxthub/core`, `drizzle-orm`, `drizzle-kit`; `hub.db` dialect from `NUXT_HUB_DB_DIALECT` (D5)
  - [ ] Verify NuxtHub dialect-specific schema file support; otherwise conditional re-export in `server/db/schema.ts`
  - [ ] `server/db/schema.sqlite.ts` + `server/db/schema.postgresql.ts` (all tables §3.4)
  - [ ] Shared inferred types in `shared/types/db.ts`; a test asserting both schemas expose identical tables/columns
- **3.2 Migrations & seed**
  - [ ] Generate migrations for both dialects (`server/db/migrations/{sqlite,postgresql}`)
  - [ ] Seed task (`server/tasks/db/seed.ts`): product types, admin user, demo shops/products (dev only)
  - [ ] Scripts: `db:generate`, `db:migrate`, `db:seed`, `db:reset`
- **3.3 Blob**
  - [ ] `hub.blob` fs (dev) / s3 (prod) config; public `images/` vs private `files/` prefixes
  - [ ] `server/routes/images/[...pathname].get.ts` serving only public prefix
- **3.4 Tests** — [ ] integration tests run against SQLite and Postgres (CI matrix)

### Phase 4 — Authentication
- **4.1 Server**
  - [ ] `nuxt-auth-utils` + `NUXT_SESSION_PASSWORD`
  - [ ] `POST /api/auth/signup` (name 4–24, email, password 8–32 + lowercase + uppercase + digit + special)
  - [ ] `POST /api/auth/login`, `POST /api/auth/logout`
  - [ ] `POST /api/auth/forgot-password` (always 200, token hashed, 1h expiry, email via Resend)
  - [ ] `POST /api/auth/reset-password` (single-use token, invalidates sessions)
  - [ ] Rate limit auth endpoints; generic error messages (no user enumeration)
  - [ ] `server/utils/auth.ts`: `requireUser`, `requireAdmin`, `requireShopOwner`, `requireApiToken`
- **4.2 UI**
  - [ ] `/login` (password eye toggle, "Don't have an account? Sign up")
  - [ ] `/signup` (live password rule checklist with `UAlert`/indicators, "Already have an account? Log in")
  - [ ] `/forget-password`, `/reset-password?token=`
  - [ ] Route middleware `auth` / `guest` / `admin`; header user menu
- **4.3 Profile** — [ ] `/profile` personal data, addresses CRUD, change password
- **4.4 Tests** — [ ] unit (password rules schema), integration (all endpoints), e2e (signup → login → logout → reset)

### Phase 5 — UI shell & static pages
- [ ] App layout (`UHeader`, `UFooter`, nav, color mode), `default` / `auth` / `dashboard` layouts
- [ ] Brand theme in `app.config.ts` + Tailwind v4 tokens in `main.css`
- [ ] Landing page `/` (hero, categories, featured products, how selling works, CTA)
- [ ] `/contact` (form → `contact_messages` + email), `/terms`, `/privacy`
- [ ] `error.vue`, SEO meta defaults, `robots`/sitemap-ready
- [ ] web-design-guidelines audit + e2e smoke for each page

### Phase 6 — Shops & products (seller)
- **6.1 Shop**
  - [ ] Create shop (name, slug, description, logo, banner) at `/my-shop`
  - [ ] Stripe Connect Express onboarding (`/my-shop/payouts`: account link, return/refresh, `account.updated` webhook)
- **6.2 Products** (`/api/v1/shop/products/**`, consumed by UI)
  - [ ] CRUD with draft/published/archived; publishing gated by D12
  - [ ] Image upload (multiple, reorder, alt text, type/size validation) → public blob
  - [ ] Digital file upload → private blob
  - [ ] Stock + shipping fee for physical products
- **6.3 Tests** — [ ] integration for every endpoint (owner vs non-owner), e2e create & publish product

### Phase 7 — Marketplace & catalog (public)
- [ ] `GET /api/products` with filters (q, minPrice, maxPrice, kind, type, sort, page) — validated query
- [ ] `/marketplace` with `UInput`, price range, `USelect`s, synced to URL query, `UPagination`
- [ ] `/products/[slug]` (gallery, reviews summary, add to cart), `/shops/[slug]`
- [ ] Tests: filter unit tests, integration, e2e browse & filter

### Phase 8 — Cart, checkout & payments
- [ ] Cart API + `useCart` composable; header cart badge
- [ ] `/checkout` address step (physical only) → Stripe Checkout Session (D1)
- [ ] `POST /api/stripe/webhook`: signature check, idempotency, handlers (§3.5)
- [ ] Transfers per seller, stock decrement (transactional), download grants
- [ ] `transaction_logs` written for every money event (helper `logTransaction`)
- [ ] Order confirmation emails (buyer + each seller)
- [ ] Tests: fee/split math unit tests, webhook integration tests with signed test payloads, e2e with Stripe test card

### Phase 9 — Post-purchase
- [ ] Buyer `/orders`, `/orders/[id]`, signed download links (D8)
- [ ] Seller `/my-shop/orders`: mark shipped (carrier + tracking), delivered
- [ ] Seller refunds (full) → refund + transfer reversal + logs (D15)
- [ ] Reviews (only verified buyers, one per product) + rating aggregates
- [ ] Tests for each flow

### Phase 10 — Public REST API & docs
- [ ] API tokens UI (`/my-shop/api-tokens`): create (shown once), scopes, revoke
- [ ] Bearer auth in `requireApiToken`; per-token rate limit
- [ ] Nitro OpenAPI (`nitro.experimental.openAPI`) + `defineRouteMeta` on every `/api/v1/**` route
- [ ] `/my-shop/api-docs` renders Scalar (`@scalar/api-reference`) client-only
- [ ] Tests: token auth integration, OpenAPI snapshot test

### Phase 11 — Admin & moderation
- [ ] `/admin` dashboard: users, shops (suspend), products (suspend), transaction logs (filters, CSV export)
- [ ] `audit_logs` for every admin action
- [ ] Tests

### Phase 12 — Quality pass
- [ ] Coverage targets: unit ≥ 80% on `shared/` + `server/utils/`
- [ ] Full e2e suite (buyer journey, seller journey, admin journey)
- [ ] Accessibility & UX audit (web-design-guidelines skill) on all pages; fix findings
- [ ] Exploratory QA with `agent-browser`

### Phase 13 — CI/CD
- [ ] `ci.yml`: install (Bun cache) → Biome CI → typecheck → unit → integration (matrix sqlite/postgres service) → build → smoke → e2e (Playwright report artifact)
- [ ] `commitlint.yml` on PR titles/commits
- [ ] `release.yml`: on `v*.*.*` tag → changelog → GitHub Release → Docker build & push to GHCR
- [ ] `deploy.yml` (manual/dispatch): SSH + `docker compose pull && up -d` (secrets documented)
- [ ] Renovate/Dependabot for Bun deps

### Phase 14 — Hardening & launch readiness
- [ ] Security headers / CSP / rate limiting (nuxt-security — pending approval)
- [ ] Performance (image sizes, caching `routeRules`, DB indexes)
- [ ] Final docs pass; `v1.0.0` release

---

## 7. Risks & open questions

- NuxtHub dual-schema ergonomics (verify in 3.1). Fallback: plain Drizzle + custom `server/utils/db.ts` (documented exception).
- Bun as Nuxt runtime (`bun --bun nuxt dev`) — fall back to Node for any failing step and log it here.
- Stripe Connect Express availability depends on the seller's country; test mode is enough for development.
- Separate charges & transfers: platform balance must cover refunds before reversals settle.

---

## 8. Change History

| Date | Change |
|------|--------|
| 2026-09-24 | Phase 0 complete: research, grill-me decisions, skills/MCP, Nuxt 4.5.2 scaffold, docs, first commit. |
