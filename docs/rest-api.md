# REST API

- Base path: `/api/v1`. Shop management under `/api/v1/shop/**` (shop, products, images, files —
  done, Phase 6; orders, fulfillment, refunds — done, Phase 9).
- Auth: session cookie **or** `Authorization: Bearer <token>` (Phase 10), checked in each handler via
  `requireUser`/`requireShopOwner`/`requireProductOwner` (`server/utils/auth.ts`) — no `server/middleware/`.
  Token scopes and limits: docs/authentication.md. Token management (`GET`/`POST /api/v1/shop/tokens`,
  `DELETE /api/v1/shop/tokens/:id`) and Stripe onboarding are session-only.
- Conventions: plural nouns, JSON bodies, `camelCase` fields, money as `*Cents` integers,
  pagination `?page=&perPage=` → `{ data, meta: { page, perPage, total } }`,
  errors `{ statusCode, statusMessage, data? }`.
- Validation with shared Zod schemas; every route declares `defineRouteMeta({ openAPI: { ... } })`.
- OpenAPI: `nitro.experimental.openAPI` collects each handler's `defineRouteMeta()`; our own
  `GET /api/v1/openapi.json` (public, `server/api/v1/openapi.json.get.ts`) builds the seller spec from it,
  adds request bodies from the shared Zod schemas (`z.toJSONSchema`), the `x-token-scope` per operation
  and both security schemes. Nitro's own `/_openapi.json`/`/_scalar`/`/_swagger` stay off in production
  (they'd list internal/admin routes). Rendered with Scalar (`@scalar/api-reference`, lazy, client-only,
  no fonts/telemetry/proxy) on `/my-shop/api-docs`. The route list is snapshot-tested
  (`tests/integration/__snapshots__/api-tokens.test.ts.snap`) — update the snapshot (`-u`) when adding routes.
- The `/my-shop` UI uses these same endpoints.

## Public catalog (Phase 7, no auth, outside `/api/v1`)

Visibility for all three (`publicProductConditions()` in `server/utils/catalog.ts`, D12): published
products of `active` shops with `chargesEnabled`. Anything else is a 404, never a 403.

- `GET /api/products` — query validated by `catalogQuerySchema` (`shared/schemas/catalog.ts`):
  `q` (case-insensitive title substring, ≤100 chars), `kind` (`physical|digital`), `type`
  (product-type slug), `shop` (shop slug), `minPrice`/`maxPrice` (**whole USD**, min ≤ max; converted
  to cents server-side), `sort` (`newest` default, `price-asc`, `price-desc`), `page`, `perPage`
  (≤48, default 24). Invalid query → 400. Returns `{ data: CatalogItem[], meta }`; `CatalogItem`
  (`shared/types/catalog.ts`) carries the first image as `coverPath`.
- `GET /api/products/:slug` — product with `type`, public `shop` fields (never `ownerId`/Stripe ids),
  ordered `images` and the latest 20 `reviews` (`rating`, `comment`, buyer first name only, `createdAt`).
- `GET /api/shops/:slug` — public shop header; its products come from `GET /api/products?shop=:slug`.
- `/sitemap.xml` lists the same public products and active shops.

## Cart, checkout and orders (Phase 8, session cookie, outside `/api/v1`)

- `GET /api/cart` → `Cart` (`shared/types/cart.ts`): lines grouped by shop, re-priced live, each line’s `problem`
  (`unavailable`/`out_of_stock`/`not_enough_stock`), totals, `hasPhysical`, `canCheckout`.
- `POST /api/cart/items` `{ productId, quantity? }` · `PATCH /api/cart/items/:productId` `{ quantity }` ·
  `DELETE /api/cart/items/:productId` — each returns the updated `Cart`. 404 hidden product, 400 own product or
  digital quantity ≠ 1, 409 over stock.
- `POST /api/checkout` `{ addressId? }` → `{ orderId, url }` (redirect the browser to `url`, Stripe Checkout).
  400 empty cart / missing address, 404 address not yours, 409 cart changed, 501 Stripe not configured,
  502 Stripe unavailable. Rate-limited 20/15 min.
- `GET /api/orders` → `BuyerOrderSummary[]` (`shared/types/order.ts`), the buyer’s orders newest first, without
  `expired`/`canceled` checkouts.
- `GET /api/orders/:id` → `BuyerOrder`: totals, address snapshot and `sellers[]` (status, carrier, tracking, items).
  Each item carries its `downloads` (a freshly signed `url`, or `null` once used up/expired/refunded), the buyer’s
  `review` and `canReview`. Someone else’s order → 404.
- `GET /downloads/:grantId?expires&signature` (server route, no session needed) — streams the private file (D8).
  The HMAC link (`server/utils/downloads.ts`) lives 10 minutes; the grant itself allows 5 downloads in 30 days.
  Bad/expired signature → 403, grant used up/expired/refunded → 410. Counting is one conditional `UPDATE`.
- `POST /api/reviews` `{ orderItemId, rating 1–5, comment? }` → 201. Only for an item of your own paid, unrefunded
  order (404/409 otherwise), one per product (409). Recomputes `products.rating_avg`/`rating_count` in the same
  transaction.
- `POST /api/stripe/webhook` — Stripe only (signature required); see docs/payments-stripe.md.

## Seller orders (Phase 9, session cookie)

All return 404 for a seller order that isn’t your shop’s (`requireOwnSellerOrder`, `server/utils/orders.ts`).

- `GET /api/v1/shop/orders` → `ShopOrder[]`: paid-or-later seller orders, newest first, with items, buyer name,
  payout and the shipping address (only when something physical is in it).
- `POST /api/v1/shop/orders/:id/ship` `{ carrier, trackingCode }` — `paid|shipped` → `shipped` (again to fix
  tracking). 400 digital-only or invalid body, 409 wrong status. Emails the buyer on the first ship.
- `POST /api/v1/shop/orders/:id/deliver` — `shipped` → `delivered`, else 409.
- `POST /api/v1/shop/orders/:id/refund` — full refund of this seller’s part (docs/payments-stripe.md step 5).
  409 unless `paid|shipped|delivered`, 502 if Stripe refuses (nothing changes).
