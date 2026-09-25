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

### Fixes
- **ui:** product pages and `/checkout/success` scrolled sideways on phones with a long unbroken title or shop name.
- **payments:** Stripe webhook signatures never verified under Bun (sync crypto API); now async.
- **payments:** a webhook handler error no longer marks the event as processed, so Stripe retries it.
- **ui:** header search rendered `[object Promise]` instead of the search box (`<search>` element is unknown to Vue).
