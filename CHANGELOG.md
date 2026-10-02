# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Add every change under `[Unreleased]` as it lands; `bun run release <patch|minor|major>` turns that section into a
version (see [docs/git-workflow.md](docs/git-workflow.md)).

## [Unreleased]

### Added
- The footer shows the running version, linked to its GitHub release.
- `bun run setup:sqlite`, `setup:postgres-local` and `setup:postgres-docker` run the matching `setups/*.sh` for the OS (Git Bash on Windows).
- `.claude/rules/` with the rules agents follow in every session (workflow, money, server security, frontend, tests, worktrees).
- Header search suggests the top 5 products from 3 characters on (accessible combobox: arrows, Enter, Esc), plus "see all N finds".
- Typing a Brazilian CEP on `/profile` fills street, neighborhood, city, state and country (ViaCEP).
- `/login`, `/signup`, password reset and `/my-shop/**` use the site layout (header + footer); the seller area gets a section nav.
- Every demo product and shop uses real CC0 photos of its category (`public/seed`), so `picsum.photos` left the CSP.
- Open source release files: `docs/system-design/` (a system design guide for learners: requirements, capacity estimates, architecture, ERD, money flow, security, caching, queues, scaling, observability, failure modes, trade-offs, exercises; Mermaid diagrams), README rewritten for open source, MIT `LICENSE` (`"license": "MIT"` in package.json), `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1), `SECURITY.md`, GitHub issue and pull request templates.
- Every `setups/*.sh` script starts the app at the end with its logs on screen, saves the session to `logs/<script>-<timestamp>.log`, and keeps the Git Bash window open on success, error or Ctrl+C.

### Changed
- Branch flow: `dev` is the sandbox and runs the full `ci`; `main` (production) only receives commits whose `dev` run passed; `deploy` refuses any ref but `main`.
- Releases: `bun run release <patch|minor|major>` (`scripts/release.ts`) replaces changelogen; GitHub Release notes come from the version's CHANGELOG section.
- Square form fields everywhere, square cards and buttons on the form pages; the signup password checklist appears under the field once you start typing.
- `CHANGELOG.md` follows Keep a Changelog; PLAN.md no longer keeps its own change history or risks section (residual risks moved to `docs/security.md`).

### Removed
- The `pre-push` hook (typecheck + unit + integration); the GitHub Actions `ci` run is the gate.
- The blinking terminal cursor in the logo.

### Fixed
- The "add address" button on `/profile` never rendered, so no address could be added and physical checkouts were blocked; saving an address now also reports errors.
- Integration and e2e runs wrote thousands of throwaway users and products into the dev database; they now use `.data-test`.
- Dark theme: near-invisible form fields (1.7:1 outlines, now 3.6:1), full neon promo bar and hero, light native controls (`color-scheme` follows the theme), solid brand empty states. Light theme: field outlines 1.6:1 → 3.4:1, success text 2.3:1 → 5:1.
- On phones, the `/my-shop` section nav truncated every label to one letter; it now scrolls horizontally.

## [1.0.0] - 2026-09-26

### Added
- Nuxt 4 + Nuxt UI 4 app on Bun with Biome, Husky + commitlint, Zod-validated runtime config (`NUXT_STRICT_ENV`), `GET /api/health`.
- NuxtHub DB with a dual Drizzle schema (SQLite and PostgreSQL, 19 tables, parity test) and migrations for both dialects; seeded product types and a labeled demo catalog.
- Auth with `nuxt-auth-utils`: signup, login, logout, forgot/reset password, `/profile` (personal data, addresses, change password); `auth`/`guest`/`admin` route middleware.
- Landing page, `/contact` (stored + emailed), `/terms`, `/privacy`, error page, `robots.txt`, sitemap.
- Shops and products for sellers: shop CRUD, branding, Stripe Connect Express onboarding, products with images, stock, shipping and private digital files; publishing requires `charges_enabled`.
- Public catalog: `GET /api/products` (search, filters, sort, pagination), `GET /api/products/:slug`, `GET /api/shops/:slug`; `/marketplace`, `/products/[slug]`, `/shops/[slug]`.
- Multi-seller cart and `/checkout` (address step for physical items) with Stripe Checkout; `/checkout/success`.
- Stripe webhook fulfilment: paid orders, stock, download grants, one transfer per seller, emails, expiry and dispute handling; every money event in `transaction_logs`.
- Buyer `/orders` and `/orders/[id]` (per-seller status, tracking, signed downloads, reviews); `GET /downloads/:grantId` behind 10-minute HMAC links, 5 downloads / 30 days per grant.
- Seller `/my-shop/orders`: mark shipped (carrier + tracking), delivered, full refund (Stripe refund + transfer reversal, downloads revoked, logged).
- Verified-buyer reviews (`POST /api/reviews`, one per product) with rating aggregates.
- Personal API tokens at `/my-shop/api-tokens` (scoped, shown once, expiring, revocable); every `/api/v1/shop/**` route accepts `Authorization: Bearer`, 120 req/min per token.
- Public OpenAPI 3.1 spec at `GET /api/v1/openapi.json` and Scalar API reference at `/my-shop/api-docs`.
- `/admin`: stats, users, shops and products with suspend/reinstate (reason required), transaction logs with filters and CSV export, `audit_logs` for every admin action; `bun run db:make-admin <email>`.
- Multi-stage Docker image, full and dev-only docker-compose stacks (PostgreSQL, SeaweedFS S3, stripe-cli), six idempotent `setups/*.sh` scripts.
- GitHub Actions: `ci` (checks, SQLite + PostgreSQL integration matrix, build + smoke + e2e), `commitlint`, `release` (GitHub Release + GHCR images on `v*` tags), manual `deploy`; Dependabot for Bun, Actions and Docker.
- 16 indexes on foreign keys and hot list/sort/lookup columns; photos downscaled to WebP in the browser before upload; uploaded images cached `immutable` for a year.

### Fixed
- The Docker image didn't build and never migrated its database; it now builds for PostgreSQL, runs as the `bun` user, stores uploads on a writable `/app/.data` volume, and ships a `migrate` target.
- `minio/minio` images no longer exist; the dev stack uses SeaweedFS. Postgres 18 volumes mount at `/var/lib/postgresql`.
- Concurrent writes on SQLite failed instantly with `SQLITE_BUSY`; libsql now waits up to 5 s.
- Stripe webhook signatures never verified under Bun (sync crypto API); now async.
- A webhook handler error no longer marks the event as processed, so Stripe retries it.
- Form labels on every dashboard page lost their inputs after hydration (`@nuxt/icon` server-only prefetch hooks shifted `useId()`).
- Sellers could republish a product an admin suspended.
- Buttons kept their capitals despite the lowercase design system; product pages and `/checkout/success` scrolled sideways on phones.
- Header search rendered `[object Promise]` (`<search>` is unknown to Vue).
- Dashboard pages get a skip link, a `<main>` landmark and a single `h1`; product cards no longer announce their title twice.

### Security
- Paid digital files could be downloaded without buying them through the public image route with an encoded `../`; the route refuses `.`/`..` segments, backslashes and leftover `%`.
- Upload filenames went into storage keys verbatim; keys are now sanitized (`blobFileName`).
- Cookie-authenticated API mutations from another origin are refused with 403 (Origin/Referer check on top of `SameSite=Lax`).
- Rate limits shared one bucket for every visitor and trusted spoofable `X-Forwarded-For`; they now key on `X-Real-IP` from the reverse proxy. Password change is limited to 10/15min.
- Security events (`login.failed`/`succeeded`, password reset requested/completed, password changed, CSRF refused) are logged as JSON lines without PII.
- GitHub Actions pinned to commit SHAs; workflows default to `contents: read`.

[Unreleased]: https://github.com/AlexGalhardo/nuxtjs-marketplace/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/AlexGalhardo/nuxtjs-marketplace/releases/tag/v1.0.0
