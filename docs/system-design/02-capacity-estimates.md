# 2. Capacity estimates

Back-of-the-envelope math tells you which part of the system breaks first. The numbers below are **assumptions**,
not measurements: there is no load test yet (PLAN.md Phase 18 plans `bun run test:load`). Change an assumption and
redo the math; that is the exercise.

## Assumptions

| Input | Value | Note |
|-------|-------|------|
| Sellers | 1,000 | Each one has a shop (`shops.owner_id` is unique) |
| Buyers | 10,000 | Registered accounts |
| Products per seller | 50 on average | The demo seed makes 100 shops × 5–20 products (`server/db/seed.ts`) |
| Images per product | 3, about 150 KB each | Photos are downscaled to WebP in the browser before upload |
| Digital share | 20% of products, one 20 MB file each | |
| Normal day | 30% of buyers active, 20 page views each, 300 orders/day | |
| Server requests per page view | 4 | SSR HTML plus `useFetch`/`$fetch` API calls; images counted separately |
| Order shape | 1.5 sellers and 2.5 items per order | Drives `seller_orders` and `order_items` rows |

## Storage

**Catalog**

- Products: 1,000 × 50 = **50,000** rows.
- Images: 50,000 × 3 = **150,000** rows; 150,000 × 150 KB ≈ **22.5 GB** of blobs.
- Digital files: 50,000 × 20% = 10,000 files × 20 MB = **200 GB** of private blobs.
- Blob total ≈ **225 GB**. Files dominate; images are what gets *served* the most.

**Orders, one year at 300 orders/day** (≈ 110,000 orders)

| Table | Rows per order | Rows per year | Bytes per row (guess) | Size per year |
|-------|----------------|---------------|-----------------------|---------------|
| `orders` | 1 | 110,000 | 500 B (address snapshot JSON) | 55 MB |
| `seller_orders` | 1.5 | 165,000 | 300 B | 50 MB |
| `order_items` | 2.5 | 275,000 | 250 B | 69 MB |
| `transaction_logs` | 3.5 (checkout.created, payment.succeeded, 1.5 × transfer.created) | 385,000 | 500 B | 193 MB |
| `stripe_events` | ~3 (every webhook delivery we store) | 330,000 | 5 KB (full event JSON) | **1.65 GB** |

Lesson: the raw webhook archive (`stripe_events.payload`) is the biggest table by far, bigger than the orders
themselves. A real system would move old payloads to cold storage after the dispute window. The relational part
fits comfortably in a single PostgreSQL instance for years.

## Traffic on a normal day

- Page views: 10,000 × 30% × 20 = **60,000/day**.
- Requests: 60,000 × 4 = 240,000/day ÷ 86,400 s ≈ **2.8 RPS** average; peak hour at 3× ≈ **8 RPS**.
- Writes: 300 checkouts/day ≈ one every 5 minutes. Writes are rare; this is a read-heavy system.

## Black Friday peak

Assume every buyer shows up inside a 4-hour window and browses 50 pages, and 30% of them buy.

- Page views: 10,000 × 50 = 500,000 in 4 h.
- Requests: 500,000 × 4 = 2,000,000 ÷ 14,400 s ≈ **139 RPS** average; the first 10 minutes at 3× ≈ **420 RPS**.
- Orders: 10,000 × 30% = 3,000. If a third of them land in the first 10 minutes: 1,000 ÷ 600 s ≈ **1.7 checkouts/s**.
- Stripe calls at that moment: 1.7 Checkout Sessions/s, then per paid order one PaymentIntent retrieve and 1.5
  transfers ≈ 1.7 × 3.5 ≈ **6 Stripe calls/s**. Stripe enforces per-account API rate limits; check its docs for the
  current numbers, but this is far from them.
- Webhooks in flight (Little's law, `L = λ × W`): 1.7 webhooks/s × ~2 s per fulfilment (one retrieve and 1.5
  transfers, sequential in `server/utils/orders.ts`; the ~2.5 emails are only enqueued) ≈ **4 concurrent** handlers.
  Fine for one process, but every one of those seconds is spent inside an HTTP request Stripe is waiting on.

### Bandwidth: the real bottleneck

Images are served by the Nuxt process itself (`server/routes/images/[...pathname].get.ts` streams from the blob
store). Assume 10 uncached images per page view at 150 KB:

- 500,000 × 10 × 150 KB = **750 GB** in 4 h.
- 750 GB ÷ 14,400 s ≈ 52 MB/s ≈ **420 Mbit/s** average, ≈ 1.25 Gbit/s in the opening spike.

The images are already sent with `cache-control: public, max-age=31536000, immutable` (keys never change), so a
CDN in front could absorb almost all of it. Without one, image bytes, not database queries, saturate the app first.

### Other limits worth knowing

- **Rate limits** (`nuxt.config.ts`): 1,000 requests / 5 min per IP globally (≈ 3.3 RPS), 20 checkouts / 15 min.
  One human never hits them; a whole office behind one NAT IP might on Black Friday.
- **Catalog search** is `lower(title) like '%q%'` (`server/utils/catalog.ts`): a full scan of the products table.
  At 50,000 rows that is milliseconds; at a few million it needs a trigram or full-text index.
- **SQLite** allows one writer at a time (`connection.timeout: 5000` waits up to 5 s for the lock). At 1.7
  checkouts/s it would cope, but SQLite is a single file on one machine, so it can't be shared by replicas.
  Production uses PostgreSQL.
- **Database connections**: every app replica keeps its own pool; N replicas × pool size must stay under
  PostgreSQL's `max_connections`. A connection pooler (PgBouncer) is the usual fix when replicas grow.

## Takeaways

1. Reads dominate (≈ 99%); writes are a few per second even on Black Friday.
2. Serve images from a CDN before scaling anything else.
3. One PostgreSQL instance holds years of orders; the webhook archive is what grows.
4. The checkout spike is small in RPS but long in latency (Stripe round trips), so work that can wait should move
   off the request path. Email already goes through a queue ([08-queues-and-async.md](08-queues-and-async.md)).
