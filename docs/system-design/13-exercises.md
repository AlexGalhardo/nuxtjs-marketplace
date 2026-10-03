# 13. Exercises for the reader

Each exercise starts from a real gap in the code. Run the app first (`bun run setup:sqlite`, see the
[README](../../README.md#quick-start)) and keep the tests green (`bun run check && bun run typecheck && bun run test:unit`).

## Warm-up

1. **Trace a purchase.** Buy something in test mode and follow it through `orders`, `seller_orders`, `order_items`,
   `download_grants` and `transaction_logs`. Which rows were written in the same transaction?
2. **Redo the capacity math** in [02-capacity-estimates.md](02-capacity-estimates.md) for 100,000 sellers and
   1,000,000 buyers. What breaks first now?
3. **Draw the refund ERD path.** Which tables does `refundSellerOrder` touch, and which of those writes are
   conditional?

## Intermediate

4. **Consistent 404s.** Make `requireShopOwner` and `requireProductOwner` (`server/utils/auth.ts`) answer 404 for
   someone else's shop or product, and update the integration tests that expect 403.
5. **Cache invalidation by tag.** The catalog cache relies on a 30 s TTL ([07-caching.md](07-caching.md)). Tag
   cached entries by shop and product and delete them when a seller edits a product or an admin suspends a shop.
   Which write paths must you cover, and what does a missed one cost?
6. **Queue-depth gauge.** Export BullMQ's `getJobCounts()` for the `mail` queue as a Prometheus gauge and add a
   Grafana alert when failed jobs grow ([10-observability.md](10-observability.md)).
7. **Search index.** On PostgreSQL, add a `pg_trgm` index for `lower(title) like '%q%'` and compare `EXPLAIN ANALYZE`
   before and after on 1,000,000 products. What do you do about SQLite?
8. **Archive webhook payloads.** Design a job that drops `stripe_events.payload` older than the dispute window. Which
   rows must you never touch?

## Advanced

9. **Stock reservation.** Reserve stock at checkout, release it on `checkout.session.expired`. Prove with a concurrent
   test that the last unit can't be sold twice. What happens to a buyer who abandons the tab?
10. **Transactional outbox.** The transfer crash window is closed by re-entrancy, because Stripe redelivers the
    webhook ([08-queues-and-async.md](08-queues-and-async.md#why-seller-transfers-are-not-queued)). Build an outbox
    for a trigger that has no retrying source: write the job row in the same transaction as the state change, relay it
    to a BullMQ queue, keep the consumer idempotent.
11. **Retry failed transfers.** Give admins a "retry" action for `transfer.failed` rows. Which idempotency key do you
    use, and why must it be the same as the first attempt?
12. **Partial refunds.** Refund one item instead of the whole seller order. How do you split the fee, the shipping and
    the transfer reversal? What new `transaction_logs` types do you need?
13. **Finish Dashboard refunds.** `charge.refunded` already writes the ledger without double-counting
    (`recordExternalRefund`). Make it also update the seller order and order status and expire downloads.
14. **Ledger reconciliation.** Write a script that checks the invariant "for every paid order, the sum of
    `transfer.created` amounts + the fee = the amount of `payment.succeeded`". What does it flag on the demo data?

## Observability

15. **Child spans around Stripe calls.** Wrap `stripe.transfers.create` and `refunds.create` in child spans of the
    request span (hint: run the handler inside `context.with(trace.setSpan(...))`, see
    [docs/observability.md](../observability.md)).
16. **Follow one purchase.** Put the order id on the `POST /api/checkout` span and on the webhook span, and the trace
    id on log lines, so one search in Grafana shows a purchase end to end ([10-observability.md](10-observability.md)).

Contributions are welcome: see [CONTRIBUTING.md](../../CONTRIBUTING.md).
