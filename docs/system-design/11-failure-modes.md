# 11. Failure modes

Every dependency fails eventually. Good design decides **in advance** what the user sees and what state is left
behind. This table describes the code as it is today.

## Dependency failures

| What fails | Where it hurts | What happens | What the user sees | Code |
|------------|----------------|--------------|--------------------|------|
| Stripe API during checkout | `POST /api/checkout` | Order and seller orders marked `canceled`; nothing charged | 502 "Payment provider is unavailable, try again"; cart intact | `server/api/checkout.post.ts` |
| Stripe API during refund | `POST .../refund` | `refund.failed` logged; no status changes | 502, seller can retry (same idempotency key) | `refundSellerOrder` |
| Stripe transfer to a seller | Webhook fulfilment | `transfer.failed` logged; buyer's order stays paid | Buyer: nothing. Seller: payout missing until an admin acts | `transferToSeller` |
| Transfer reversal after a refund | Refund | `transfer.reversal_failed` logged; buyer already refunded | Platform carries the loss until settled by hand (D1) | `refundSellerOrder` |
| Our webhook handler throws | `POST /api/stripe/webhook` | `processed_at` stays null; Stripe gets 5xx and retries later | Order stays `pending` until a retry succeeds | `server/api/stripe/webhook.post.ts` |
| Resend (email) outage | Any email | With Redis: the BullMQ job retries 5 times with exponential backoff, then stays in the failed set. Without Redis: sent inline, error logged and swallowed in the webhook | Email arrives late, or not at all; the order page still shows the truth | `server/utils/queue.ts`, `sendOrderEmails`, `notifyBuyer` |
| Resend during forgot-password | `POST /api/auth/forgot-password` | The mail isn't awaited and its error is only logged | The same 200 as for an unknown email | `server/api/auth/forgot-password.post.ts` |
| Redis down | Cache, rate limits, mail queue | Cache and nuxt-security buckets fall back to process memory (fail-open driver); token limit to its `Map`; mail sent inline when enqueueing fails | Nothing, except limits become per replica until Redis is back | `server/plugins/redis.ts`, `server/utils/auth.ts`, `server/utils/queue.ts` |
| One app replica dies | Requests on it | Caddy retries on another replica for up to 5 s (`lb_try_duration`) and keeps it out for 10 s | A slower request, not an error | `infra/caddy/Caddyfile` |
| Resend not configured | Anywhere | Emails printed to the console (D7) | Nothing, in dev and tests | `server/utils/mail.ts` |
| Database down | Every page and API | Requests error with safe messages; `/api/health` answers 503, so a new deploy never takes traffic | Error page | `app/error.vue`, `server/api/health.get.ts` |
| SQLite write lock | Concurrent writes (dev) | Waits up to 5 s, then `SQLITE_BUSY` | Slow request, rarely an error | `nuxt.config.ts` (`connection.timeout`) |
| Missing production secret | Startup | Process refuses to start when `NUXT_STRICT_ENV=true` | Deploy fails fast instead of failing later at checkout | `server/utils/env.ts` |
| Reverse proxy not setting `X-Real-IP` | Rate limiting | Every client shares one bucket per route | Everyone gets 429 together under load | [docs/infra-and-setup.md](../infra-and-setup.md) |

## Race conditions and duplicates

| Scenario | Outcome | Why |
|----------|---------|-----|
| Stripe delivers `checkout.session.completed` twice, at the same time | Fulfilled once | `stripe_events` id is the primary key; `pending → paid` is a conditional update; transfers use idempotency keys |
| Seller double-clicks "refund" | One refund, one log row | Stripe idempotency key `refund-<sellerOrderId>` + conditional status update |
| Buyer double-clicks "download" five times in parallel | At most `max_downloads` counted | One conditional `UPDATE ... WHERE download_count < max_downloads` |
| Two buyers pay for the last unit | **Both are charged**; stock clamps at 0 | Stock is checked at checkout, decremented at payment, not reserved. Documented `ponytail:` trade-off |
| Two requests add the same product to a cart | One line | Unique index `cart_items_user_product_unique` |
| Process crashes after the fulfilment commit, before transfers | Transfers run on Stripe's retry | The event stays unprocessed; `fulfillCheckout` pays every `paid` seller order with no transfer log, with idempotency keys ([08-queues-and-async.md](08-queues-and-async.md#why-seller-transfers-are-not-queued)) |

## How the system degrades

The guiding rule (OWASP A10, comments in `server/utils/orders.ts`): **once money has moved, nothing optional may
undo or block it.** Emails are optional, the ledger isn't. That is why:

- email leaves the request path through the mail queue, and errors are caught and logged, never thrown, in the
  webhook;
- the payment log is written in the same transaction as the status change;
- failed transfers become ledger rows, not exceptions, so the rest of the order completes.

Redis is treated the same way: it makes things faster and shared, never required. With Redis down the app serves
from memory and sends mail inline instead of failing.

## Two findings that were fixed

1. **Forgot-password and enumeration.** The endpoint always answers 200 to avoid revealing which emails exist, but
   it only sends mail when the user exists, so a failing Resend used to make existing emails return an error. The
   mail is now not awaited and its error never reaches the response (and with Redis it is only an enqueue).
2. **Liveness lied a little.** `/api/health` used to answer ok without touching the database. It now runs a one-row
   query and answers 503 when it fails, so it is a readiness check
   ([09-scaling-and-load-balancing.md](09-scaling-and-load-balancing.md#things-to-get-right)).
