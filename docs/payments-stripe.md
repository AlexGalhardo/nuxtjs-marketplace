# Payments with Stripe

Model: **Stripe Connect Express** + **separate charges and transfers**, USD, integer cents.

1. Seller onboarding (Phase 6, done): `POST /api/v1/shop/stripe/onboarding` creates (or reuses) an
   Express account and returns a fresh Account Link URL (`server/api/v1/shop/stripe/onboarding.post.ts`).
   `POST /api/stripe/webhook` verifies the signature and, on `account.updated`, stores
   `charges_enabled` / `payouts_enabled` on the shop. `requireProductOwner`'s publish handler
   (`server/api/v1/shop/products/[id]/publish.post.ts`) 409s until `charges_enabled` is true (D12).
2. Cart (Phase 8, done): `/api/cart` + `/api/cart/items[/:productId]` (login required, D2). `loadCart()`
   (`server/utils/cart.ts`) re-prices every line from the DB on each read and flags lines that became
   unavailable/out of stock; digital items are always quantity 1; buying from your own shop is a 400.
3. Checkout (`POST /api/checkout`, Phase 8, done): re-validates the cart, requires one of the buyer’s own
   addresses when anything is physical (snapshotted into `orders.shipping_address`), creates `orders` +
   `seller_orders` + `order_items` as `pending` in one DB transaction, then a Checkout Session on the platform
   account (`payment_intent_data.transfer_group = <orderId>`, `metadata.orderId`, idempotency key
   `checkout-<orderId>`) and logs `checkout.created`. If Stripe fails, the order is marked `canceled` (A10).
   Stock is **not reserved** at this point (see the `ponytail:` note in `server/api/checkout.post.ts`).
4. Webhook (`POST /api/stripe/webhook`, raw body, signature verified with `STRIPE_WEBHOOK_SECRET` via the
   **async** `constructEventAsync` — the sync one always throws under Bun):
   - Idempotency: the event id goes into `stripe_events`; an event is skipped only once `processed_at` is set,
     so a handler that throws gets retried by Stripe. Handlers are themselves safe to repeat.
   - `account.updated` → shop `charges_enabled`/`payouts_enabled`.
   - `checkout.session.completed` / `async_payment_succeeded` (only when `payment_status = paid`) →
     `fulfillCheckout()` (`server/utils/orders.ts`): in one transaction, order + seller orders `paid` (conditional
     on `pending`, so only the first delivery fulfils), stock decremented (clamped at 0), download grants
     (5 downloads / 30 days per file, D8), bought items removed from the cart, `payment.succeeded` logged.
     Then one Transfer per seller order (`payout = subtotal + shipping − fee`, `source_transaction` = the
     charge, idempotency key `transfer-<sellerOrderId>`) logged as `transfer.created`, or `transfer.failed`
     (not retried automatically yet — Phase 11 admin tooling). Buyer and seller emails last; a mail failure
     never fails the webhook.
   - `checkout.session.expired` / `async_payment_failed` → order `expired`, seller orders `canceled`, logged.
   - `charge.dispute.created` → `dispute.created` logged against the order. `charge.refunded` lands in Phase 9.
5. Refund by seller: `refunds.create` on the charge + `transfers.createReversal` for that seller's transfer.

## Platform fee

`fee = round(itemsSubtotalCents * NUXT_PLATFORM_FEE_BPS / 10000)` per seller order; shipping is not charged a fee.
The math lives in `shared/utils/pricing.ts` and is unit-tested. Shipping is the seller’s flat rate **per
product line** (not per unit, D11) and goes to the seller in full.

## Transaction logs (mandatory)

Every step above calls `logTransaction(...)`, inserting into the append-only `transaction_logs` table with the
Stripe object id, amount, status and raw payload. Nothing money-related happens without a log row.

## Local development

Use Stripe **test mode** keys. Forward webhooks with the Stripe CLI
(`stripe listen --forward-to localhost:3000/api/stripe/webhook`), also available as a service in
`infra/docker-compose.dev.yml`.
