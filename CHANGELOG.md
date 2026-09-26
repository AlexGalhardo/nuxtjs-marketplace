# Changelog

All notable changes to this project are documented here.
The format follows [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) and this project adheres to [Semantic Versioning](https://semver.org/).

Entries are generated with `bun run release` (changelogen).

## Unreleased

### Fixes
- **profile:** the "add address" button never rendered (it sat in a `UPageCard` slot that doesn't exist), so no address could be added and physical checkouts were blocked; saving an address now also reports errors.
- **test:** integration and e2e runs wrote thousands of throwaway users and photo-less products into the dev database; they now use `.data-test`.
- **ui:** the logo's blinking terminal cursor is gone.
- **ui:** dark theme: form fields were nearly invisible (1.7:1 outlines, now 3.6:1), the promo bar and home hero stayed full neon blocks (now a phosphor "terminal screen"), native controls stayed light (`color-scheme` now follows the theme), and empty states were solid brand blocks (alerts now default to `subtle`). Light theme: field outlines 1.6:1 → 3.4:1 and success text 2.3:1 → 5:1.
- **ui:** on phones, the `/my-shop` section nav truncated every label to one letter; it now scrolls horizontally.

### Features
- **search:** the header search suggests the top 5 products from 3 characters on (accessible combobox: arrows, Enter, Esc), plus "see all N finds".
- **profile:** typing a Brazilian CEP fills street, neighborhood, city, state and country (ViaCEP).
- **ui:** `/login`, `/signup`, password reset and `/my-shop/**` now use the site layout (header + footer); the seller area gets a section nav.
- **ui:** square form fields everywhere, square cards and buttons on the form pages; the signup password checklist appears under the field once you start typing.
- **seed:** every demo product and shop uses real CC0 photos of its category (`public/seed`), so `picsum.photos` left the CSP.
- **setup:** every `setups/*.sh` script now starts the app at the end with its logs on screen, saves the whole session to `logs/<script>-<timestamp>.log`, and keeps the Git Bash window open (press Enter to close) on success, error or Ctrl+C.

## v1.0.0 (2026-09-26)

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
- **security:** cookie-authenticated API mutations from another origin are refused with 403 (Origin/Referer check on top of `SameSite=Lax`).
- **security:** security events (`login.failed`/`succeeded`, password reset requested/completed, password changed, CSRF refused) are logged as JSON lines without PII; password change is rate-limited (10/15min).
- **perf:** 16 indexes on foreign keys and the hot list/sort/lookup columns (both dialects, migrations `0001`/`0002`); every seller/buyer list, the catalog and the webhook's checkout-session lookup now use an index.
- **perf:** photos are downscaled in the browser to WebP (≤1600px; logos 512px, banners 2400px) before upload; uploaded images are served `immutable` for a year; `/api/product-types` is browser-cached for an hour.

### Fixes
- **security:** rate limits shared one bucket for every visitor (Nitro's Bun server hides the socket address) and trusted spoofable `X-Forwarded-For`; they now key on `X-Real-IP` from the reverse proxy.
- **security:** paid digital files could be downloaded without buying them through the public image route with an encoded `../` (`/images/..%2Ffiles/…`, also double-encoded); the route now refuses any path with `.`/`..` segments, backslashes or leftover `%`.
- **security:** upload filenames went into storage keys verbatim, so `../` could place objects outside their prefix and a `%` in the name crashed the upload; keys are now sanitized (`blobFileName`), the original name is kept for display.
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
