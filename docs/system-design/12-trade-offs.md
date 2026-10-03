# 12. Trade-offs and "why not"

Every decision gives something up. The decision log with all 23 entries is [PLAN.md §2](../../PLAN.md); these are the
ones most worth studying.

## Decisions taken

| Decision | Gained | Given up |
|----------|--------|----------|
| **Separate charges and transfers** (D1) instead of destination charges | One payment for a multi-seller cart, N transfers grouped by `transfer_group` | The platform is liable first for refunds and disputes; its balance must cover refunds before reversals settle |
| **Multi-seller cart** (D2) | Mercado Livre-like UX | A three-level order model (`orders` → `seller_orders` → `order_items`) and per-seller statuses |
| **Integer cents, USD only** (D4) | Exact arithmetic, no FX | No multi-currency |
| **Dual SQLite + PostgreSQL schema** (D5) | Zero-setup dev; production-grade database in Docker | Two schema files, two migration folders, a parity test, CI matrix on both |
| **Stateless sealed-cookie sessions** (D6) | No session store; replicas need nothing shared | One user lookup per request for revocation (`passwordVersion`) |
| **Monolith** (one Nuxt app) | One deploy, one process to debug, shared types and Zod schemas end to end | Can't scale the API apart from SSR; a bad deploy takes everything down |
| **Dogfooded REST API** (D14) | The seller UI and the public API can't drift | The UI pays the public API's constraints (scopes, versioned paths) |
| **No stock reservation** | Simple checkout, no expiry job to release holds | Rare oversell of the last unit |
| **Only mail is queued**; transfers stay in the webhook, made re-entrant | Stripe's redelivery is the retry, no outbox or relay to run | Webhook latency grows with the number of sellers ([08-queues-and-async.md](08-queues-and-async.md)) |
| **Optional Redis, fail-open** | Dev and tests need nothing; a Redis outage never fails a request | Per-replica limits and no cache while it is down |
| **Cache with a 30 s TTL, no invalidation** | No key tracking on writes, no missed-invalidation bugs | Up to ~30 s of stale prices and stock on browse pages ([07-caching.md](07-caching.md)) |
| **Full refunds only** (D15) | One refund per seller order, simple state machine | No partial refunds |

## "Why not …?"

### Why not MongoDB?

PLAN.md Phase 21 lists MongoDB as **dropped on purpose**. The reasons are the useful lesson:

1. **The data is relational.** Users own shops, shops own products, orders split into seller orders that point at
   shops and contain items that point at products; reviews point at order items. Almost every screen is a join:
   `/my-shop/orders` joins seller orders, order items, orders and users. In a document store you either embed
   (and duplicate data that then drifts) or reference (and do the joins by hand in application code).
2. **Money needs multi-row ACID transactions.** Fulfilment marks the order paid, marks seller orders paid, decrements
   stock, creates download grants, clears cart lines and writes the ledger row **in one transaction**
   (`fulfillCheckout`). Either all of it happens or none of it does.
3. **Constraints belong in the database.** Unique indexes stop duplicate cart lines, duplicate reviews and duplicate
   webhook events even when two requests race. Foreign keys stop orphans.
4. **Loose data already has a home.** PostgreSQL `jsonb` stores the address snapshots, Stripe payloads and audit
   metadata that genuinely have no fixed shape (`server/db/schema.postgresql.ts`).

A document database shines when the data is naturally one aggregate read and written whole (a CMS page, an event
blob) and joins are rare. That isn't this domain.

### Why not microservices?

One developer, a few RPS normally, a few hundred on the Black Friday estimate
([02-capacity-estimates.md](02-capacity-estimates.md)). Microservices would turn every in-process function call into a
network call that can fail, and the single DB transaction in `fulfillCheckout` into a distributed saga. The monolith
is organised by domain (`server/api/cart`, `orders`, `v1/shop`, `admin`), so a module could be extracted later if one
part needs to scale or deploy on its own.

### Why not Stripe Elements / Payment Intents directly?

Stripe Checkout (a hosted page) keeps card data off our servers entirely, handles 3-D Secure and async payment methods,
and needs one API call. The price is less control over the payment page's look.

### Why not reserve stock at checkout?

Reservation needs holds with expiry, a job to release them when a Checkout Session expires, and makes abandoned
checkouts block real buyers. At this scale an occasional oversell of the last unit, visible to the seller (stock
clamps at 0), costs less than that machinery. A high-demand drop (limited sneakers) would flip this decision.

### Why not a server-side session store?

Sealed cookies scale horizontally for free. The usual objection, "you can't revoke them", is handled with the
`passwordVersion` check ([06-auth-and-security.md](06-auth-and-security.md#stateless-sessions)). What it can't do: log
out one specific device without changing the password.

### Why Redis only arrived with the second replica

At one replica nothing needed it: in-process rate limits were exact, and there was no cache pressure. It arrived in
Phase 21 together with the second replica that made shared buckets necessary, and it stays optional: without
`REDIS_URL` the app behaves exactly as before. Adding infrastructure before the problem exists is the most common
over-engineering in system design interviews and in real projects.

### Why not an OpenTelemetry Collector?

The app exports traces straight to Tempo (or Railway tracing) over OTLP, and Prometheus scrapes it directly. A
collector earns its place when several services need shared sampling, batching or routing to many backends; with one
app it would be one more container to run and monitor.
