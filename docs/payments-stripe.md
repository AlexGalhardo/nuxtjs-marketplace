# Payments with Stripe

Model: **Stripe Connect, Accounts v2** (Express dashboard, platform collects fees and owns losses, recipient
configuration) + **separate charges and transfers**, USD, integer cents. The platform account must be a **US**
account: a BR platform can't create US connected accounts, and BR recipients would also need card payments (tried
in the sandbox, 2026-10-02; D26).

1. Seller onboarding: `POST /api/v1/shop/stripe/onboarding` creates (or reuses) the shop's v2 account
   (`stripe.v2.core.accounts.create`, `stripe_balance.stripe_transfers` requested, country `us`) and returns a
   fresh v2 account link (`use_case.account_onboarding`, configuration `recipient`). Stripe no longer lets new
   platforms create v1 accounts (`type: 'express'`). Readiness is the v2 capability
   `configuration.recipient.capabilities.stripe_balance.stripe_transfers.status === 'active'` — v1
   `charges_enabled` stays false for recipient-only accounts — synced by `syncShopStripeStatus()`
   (`server/utils/stripe.ts`) from the `account.updated` webhook and from `POST /api/v1/shop/stripe/sync`,
   which the return page calls. The publish handler 409s until it is active (`shops.charges_enabled`, D12).
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
   - `account.updated` → `syncShopStripeStatus()` re-reads the v2 recipient capability.
   - `checkout.session.completed` / `async_payment_succeeded` (only when `payment_status = paid`) →
     `fulfillCheckout()` (`server/utils/orders.ts`): in one transaction, order + seller orders `paid` (conditional
     on `pending`, so only the first delivery fulfils), stock decremented (clamped at 0), download grants
     (5 downloads / 30 days per file, D8), bought items removed from the cart, `payment.succeeded` logged.
     Then one Transfer per seller order (`payout = subtotal + shipping − fee`, `source_transaction` = the
     charge, idempotency key `transfer-<sellerOrderId>`) logged as `transfer.created`, or `transfer.failed`
     (not retried automatically yet — Phase 11 admin tooling). Buyer and seller emails last; a mail failure
     never fails the webhook.
   - `checkout.session.expired` / `async_payment_failed` → order `expired`, seller orders `canceled`, logged.
   - `charge.dispute.created` → `dispute.created` logged against the order.
   - `charge.dispute.closed` → `dispute.closed` (status `won`/`lost`) logged against the order.
   - `charge.refunded` → refunds made outside the app (Stripe Dashboard) logged as `refund.created`
     (`payload.source = stripe_dashboard`); only the amount the ledger doesn't already know, so the app's own
     refunds and re-deliveries add nothing. The order status is left for an admin to reconcile.
   - `account.updated` arrives on a separate **Connect** endpoint (connected accounts' events); the webhook
     accepts both signing secrets, comma-separated in `NUXT_STRIPE_WEBHOOK_SECRET`.
   - Endpoints are created by `bun run stripe:bootstrap <site-url> [--railway]` (`scripts/stripe-bootstrap.ts`).
5. Refund by seller (Phase 9, done): `POST /api/v1/shop/orders/:id/refund` → `refundSellerOrder()`
   (`server/utils/orders.ts`). Full refunds only (D15), per seller order:
   - `refunds.create` on the payment intent for `subtotal + shipping` of that seller order (what the buyer paid
     that seller; the platform gives up its fee), idempotency key `refund-<sellerOrderId>`. Stripe failure → 502,
     `refund.failed` logged, nothing else changes.
   - In one DB transaction, conditional on the seller order still being `paid|shipped|delivered` (so a double
     click logs once): seller order `refunded`, its download grants expire now, order `refunded` (every seller
     order refunded/canceled) or `partially_refunded`, `refund.created` logged.
   - `transfers.createReversal` of the seller's transfer for the full payout (idempotency key
     `reversal-<sellerOrderId>`) → `transfer.reversed`, or `transfer.reversal_failed` (buyer already refunded;
     the platform carries it until settled by hand, D1). Skipped when the original transfer had failed.
   - Buyer email. Stock is not restocked.
   Refunds started in the Stripe Dashboard only reach the ledger (`charge.refunded` → `refund.created`); the order,
   downloads and transfer reversal are untouched, so refund from `/my-shop/orders` to keep them consistent.

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
