# Changelog

All notable changes to this project are documented here.
The format follows [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) and this project adheres to [Semantic Versioning](https://semver.org/).

Entries are generated with `bun run release` (changelogen).

## Unreleased

### Features
- **catalog:** public `GET /api/products` (search, kind/type/shop/price filters, sort, pagination), `GET /api/products/:slug`, `GET /api/shops/:slug`.
- **ui:** `/marketplace`, `/products/[slug]` and `/shops/[slug]` pages; sitemap lists public products and shops.
- **cart:** multi-seller cart API and `/cart` page with a header badge; add to cart on product pages.
- **checkout:** `/checkout` with an address step, Stripe Checkout Session, `/checkout/success`.
- **payments:** webhook fulfilment (paid orders, stock, download grants, per-seller transfers, emails), expiry and dispute handling; every money event in `transaction_logs`.
- **orders:** buyer `/orders` and `/orders/[id]` (per-seller status, tracking, downloads, reviews); `GET /api/orders`, richer `GET /api/orders/:id`.
- **downloads:** `GET /downloads/:grantId` streams private files behind 10-minute HMAC-signed links; 5 downloads / 30 days per grant.
- **fulfilment:** seller `/my-shop/orders`: mark shipped (carrier + tracking, buyer emailed), mark delivered, full refund (Stripe refund + transfer reversal, downloads revoked, logged).
- **reviews:** verified-buyer reviews (`POST /api/reviews`, one per product) with recomputed rating aggregates; reviews listed on product pages.
- **api:** personal API tokens at `/my-shop/api-tokens` (scoped `shop|products|orders` × `read|write`, shown once, expiring, revocable); every `/api/v1/shop/**` route accepts `Authorization: Bearer`, rate-limited 120 req/min per token.
- **api:** public OpenAPI 3.1 spec at `GET /api/v1/openapi.json` (from `defineRouteMeta` + shared Zod schemas) and Scalar API reference at `/my-shop/api-docs`.
- **admin:** list filters (search, role/status, pagination) live in the URL, so admin views are shareable and survive reloads.
- **admin:** `/admin` dashboard (marketplace stats, audit log), users, shops and products with suspend/reinstate (reason required), transaction logs with filters and CSV export; every admin action written to `audit_logs`; `bun run db:make-admin <email>`.
- **ci:** GitHub Actions: `ci` (checks, SQLite + PostgreSQL integration matrix, build + smoke + e2e), `commitlint` on PRs, `release` (GitHub Release + GHCR images on `v*` tags), manual `deploy`; Dependabot for Bun, Actions and Docker.

### Fixes
- **infra:** the Docker image didn't build (`addgroup` missing in `oven/bun`) and never migrated its database; it now builds for PostgreSQL (`DATABASE_URL` read at run time), runs as the image's `bun` user, stores uploads under a writable `/app/.data` volume, and ships a `migrate` target that compose runs before the app.
- **infra:** `minio/minio` images no longer exist; the dev stack uses SeaweedFS (`chrislusf/seaweedfs:4.47`) for S3. Postgres 18 volumes mount at `/var/lib/postgresql` (the old `/data` path refused to start).
- **db:** concurrent writes on SQLite failed instantly with `SQLITE_BUSY` (500s): libsql pools several connections with a 0 ms busy timeout; now waits up to 5 s.
- **ui:** buttons kept their capitals despite the lowercase design system (UA stylesheet resets `text-transform`); the footer category list no longer wraps every label on phones.
- **a11y:** dashboard pages get a skip link, a `<main>` landmark and a single `h1`; product cards no longer announce their title twice.
- **ui:** form labels on every dashboard page (`/my-shop/**`, `/admin/**`) lost their inputs after hydration: `@nuxt/icon`'s server-only prefetch hooks shifted `useId()` between SSR and client.
- **shop:** sellers could republish a product an admin suspended (via archive → publish).
- **ui:** product pages and `/checkout/success` scrolled sideways on phones with a long unbroken title or shop name.
- **payments:** Stripe webhook signatures never verified under Bun (sync crypto API); now async.
- **payments:** a webhook handler error no longer marks the event as processed, so Stripe retries it.
- **ui:** header search rendered `[object Promise]` instead of the search box (`<search>` element is unknown to Vue).
