# Payments with Stripe (planned — Phases 6, 8, 9)

Model: **Stripe Connect Express** + **separate charges and transfers**, USD, integer cents.

1. Seller onboarding: create Express account → Account Link → webhook `account.updated`
   stores `charges_enabled` / `payouts_enabled`. Publishing products requires `charges_enabled`.
2. Checkout (`POST /api/checkout`): the server recomputes prices, stock and shipping; creates `orders`,
   `seller_orders` and `order_items` as `pending`; creates a Checkout Session on the platform account with
   `payment_intent_data.transfer_group = <orderId>` and `metadata.orderId`.
3. Webhook (`POST /api/stripe/webhook`, raw body, signature verified with `STRIPE_WEBHOOK_SECRET`):
   - Idempotency: insert the event id into `stripe_events`; skip if already processed.
   - `checkout.session.completed` → mark paid, decrement stock, create one Transfer per seller order
     (`subtotal + shipping − platform fee`, `source_transaction = charge id`), grant downloads, send emails.
   - `checkout.session.expired` → order `expired`.
   - `charge.refunded`, `charge.dispute.created`, `account.updated` → update + log.
4. Refund by seller: `refunds.create` on the charge + `transfers.createReversal` for that seller's transfer.

## Platform fee

`fee = round(itemsSubtotalCents * NUXT_PLATFORM_FEE_BPS / 10000)` per seller order; shipping is not charged a fee.
The math lives in `shared/utils/pricing.ts` and is unit-tested.

## Transaction logs (mandatory)

Every step above calls `logTransaction(...)`, inserting into the append-only `transaction_logs` table with the
Stripe object id, amount, status and raw payload. Nothing money-related happens without a log row.

## Local development

Use Stripe **test mode** keys. Forward webhooks with the Stripe CLI
(`stripe listen --forward-to localhost:3000/api/stripe/webhook`), also available as a service in
`infra/docker-compose.dev.yml`.
