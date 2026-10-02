---
paths:
  - "server/**"
  - "shared/**"
  - "tests/**"
---

# Money and Stripe (docs/payments-stripe.md)

- Money is **integer cents (USD)** everywhere: DB, API, Stripe. Format only at the edge (`shared/utils/money.ts`).
- The server recomputes every price, shipping, fee and stock from the DB; never trust a client amount.
- Every money event (charge, transfer, refund, reversal, dispute, failure) writes one append-only row through
  `logTransaction()`; never update or delete `transaction_logs`.
- Stripe calls that move money pass an idempotency key; webhook handlers are idempotent (`stripe_events`) and
  only mark an event processed after the handler succeeds, so Stripe retries failures.
- Verify webhook signatures with `constructEventAsync` (the sync variant always throws under Bun).
- Integration tests use the fake Stripe API (`tests/integration/helpers/fake-stripe.ts`); never hit real Stripe in CI.
