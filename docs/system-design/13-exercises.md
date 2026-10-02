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
5. **Readiness probe.** Add a readiness endpoint that runs a cheap database query and reveals nothing else. Keep
   `/api/health` as liveness. Where should Docker and a load balancer point?
6. **Close the forgot-password side channel** ([11-failure-modes.md](11-failure-modes.md#two-subtle-findings-worth-discussing))
   and write the test that proves both cases return the same status.
7. **Search index.** On PostgreSQL, add a `pg_trgm` index for `lower(title) like '%q%'` and compare `EXPLAIN ANALYZE`
   before and after on 1,000,000 products. What do you do about SQLite?
8. **Archive webhook payloads.** Design a job that drops `stripe_events.payload` older than the dispute window. Which
   rows must you never touch?

## Advanced

9. **Stock reservation.** Reserve stock at checkout, release it on `checkout.session.expired`. Prove with a concurrent
   test that the last unit can't be sold twice. What happens to a buyer who abandons the tab?
10. **Transactional outbox.** Fix the crash window between the fulfilment commit and the seller transfers
    ([05-money-flow.md](05-money-flow.md#known-gaps-honest-list)): write a "transfer" outbox row in the same transaction,
    process it with retries, keep the `transfer-<sellerOrderId>` idempotency key.
11. **Retry failed transfers.** Give admins a "retry" action for `transfer.failed` rows. Which idempotency key do you
    use, and why must it be the same as the first attempt?
12. **Partial refunds.** Refund one item instead of the whole seller order. How do you split the fee, the shipping and
    the transfer reversal? What new `transaction_logs` types do you need?
13. **Sync Dashboard refunds.** Handle `charge.refunded` so a refund made in the Stripe Dashboard updates the order,
    expires downloads and writes the ledger, without double-counting refunds made from `/my-shop/orders`.
14. **Ledger reconciliation.** Write a script that checks the invariant "for every paid order, the sum of
    `transfer.created` amounts + the fee = the amount of `payment.succeeded`". What does it flag on the demo data?

## Build the planned phases yourself

15. **Phase 21:** Redis cache with invalidation, shared rate limits, BullMQ worker, nginx + 2 replicas
    ([07](07-caching.md), [08](08-queues-and-async.md), [09](09-scaling-and-load-balancing.md)).
16. **Phase 22:** OpenTelemetry spans that carry the order id from `POST /api/checkout` to the webhook
    ([10-observability.md](10-observability.md)).

Contributions are welcome: see [CONTRIBUTING.md](../../CONTRIBUTING.md).
