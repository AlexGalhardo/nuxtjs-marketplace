# Architecture

## Overview
A single Nuxt 4 application (SSR) serving both the Vue frontend (`app/`) and the Nitro backend (`server/`).
There is no separate backend service.

```
Browser ──useFetch/$fetch──▶ Nitro (server/api/**)
                              ├─ auth: nuxt-auth-utils session cookie | Bearer API token
                              ├─ data: Drizzle via NuxtHub DB (SQLite | PostgreSQL)
                              ├─ files: NuxtHub Blob (fs | S3/SeaweedFS)
                              ├─ payments: Stripe (Checkout + Connect Express)
                              └─ email: Resend
Stripe ──webhook──▶ /api/stripe/webhook
```

## Key decisions (full list: PLAN.md §2)
- **Multi-seller cart** paid in one Stripe Checkout; the order is split into `seller_orders`,
  and each seller receives a Stripe **Transfer** (separate charges and transfers).
- **Money is integer cents in USD.** Never use floats for money. Helpers live in `shared/utils/money.ts`.
- **Append-only `transaction_logs`**: every money-related event (checkout created, paid, transfer,
  refund, reversal, dispute) is written once and never updated or deleted.
- **Dogfooding**: the `/my-shop` UI calls the same `/api/v1/shop/**` endpoints exposed to API token users.
- **Dialect chosen at build time** (`NUXT_HUB_DB_DIALECT`): SQLite for zero-setup dev, PostgreSQL for docker/prod.

## Request lifecycle (server)
1. `server/middleware/` resolves the auth context (session or API token) — no redirects here.
2. Route handler (`defineEventHandler`) validates input with Zod schemas from `shared/schemas`
   via `readValidatedBody` / `getValidatedQuery`.
3. Authorization with `server/utils/auth.ts` helpers (`requireUser`, `requireShopOwner`, `requireAdmin`).
4. Data access with Drizzle (`db` from `@nuxthub/db`) directly in handlers or in `server/utils/*` for reuse.
5. Errors via `createError({ statusCode, statusMessage, data })`.
