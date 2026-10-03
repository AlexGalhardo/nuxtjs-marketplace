# System design of resell.sh

A walkthrough of how this marketplace is designed, written for people learning system design. Every page
describes **this** codebase and cites the files that implement it, so you can read the doc and the code side by side.

resell.sh is a mini Mercado Livre / Enjoei: anyone can buy and sell physical and digital products, a buyer pays
several sellers in one Stripe Checkout, and the platform splits the money with Stripe Connect.

## How to read this guide

Start with requirements and estimates (what are we building, how big is it), then the architecture and data model,
then the money flow (the most interesting part). The scaling pages come last because they describe how the design
would grow.

| # | Page | What you learn |
|---|------|----------------|
| 1 | [Requirements](01-requirements.md) | Functional and non-functional requirements, what is out of scope |
| 2 | [Capacity estimates](02-capacity-estimates.md) | Back-of-the-envelope math: 1,000 sellers, 10,000 buyers, a Black Friday peak |
| 3 | [High-level architecture](03-architecture.md) | C4 context and container views, the request lifecycle |
| 4 | [Data model](04-data-model.md) | ERD of the 19 tables, snapshots, indexes, dual SQLite/PostgreSQL schema |
| 5 | [Money flow](05-money-flow.md) | Checkout → Stripe → webhook → fulfilment → transfers → refunds, idempotency, the ledger |
| 6 | [Auth and security](06-auth-and-security.md) | Stateless sessions, API tokens, CSRF, rate limits, signed download links |
| 7 | [Caching](07-caching.md) | HTTP caching, the Redis response cache, TTL + stale-while-revalidate instead of invalidation |
| 8 | [Queues and async work](08-queues-and-async.md) | The BullMQ mail queue, and why seller transfers are re-entrant instead of queued |
| 9 | [Load balancing and horizontal scaling](09-scaling-and-load-balancing.md) | The state checklist, Caddy in front of N replicas, Railway's edge, Redis fail-open |
| 10 | [Observability](10-observability.md) | Audit trails, OpenTelemetry traces, Prometheus metrics, Loki logs, Grafana |
| 11 | [Failure modes](11-failure-modes.md) | What breaks, what the user sees, how the system degrades |
| 12 | [Trade-offs and "why not"](12-trade-offs.md) | Why Stripe Connect separate charges, why no MongoDB, why no microservices |
| 13 | [Exercises for the reader](13-exercises.md) | Hands-on changes to try, from small to hard |

## Built vs planned

Everything these pages describe is in the repository, including Phase 21 (Redis cache and shared rate limits, the
BullMQ mail queue, Caddy in front of 2+ replicas) and Phase 22 (OpenTelemetry, Prometheus, Grafana, Tempo, Loki).
What is not built yet is named as such where it comes up ("not handled yet", "known gaps") and collected as
[exercises](13-exercises.md).

## Interactive diagrams

The app serves the main diagrams as interactive Vue Flow graphs at `/system-design` (`app/pages/system-design.vue`,
linked from the footer): architecture, request lifecycle, money flow, data model, scaling and observability.

## Where the rest of the documentation lives

- [PLAN.md](../../PLAN.md): scope, decision log (D1–D25), phase checklist.
- [docs/](../README.md): the operational guides this guide builds on (architecture, database, payments, security…).
