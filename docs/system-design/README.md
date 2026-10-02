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
| 7 | [Caching](07-caching.md) | HTTP caching today; Redis cache (planned) |
| 8 | [Queues and async work](08-queues-and-async.md) | What runs inline today; BullMQ workers (planned) |
| 9 | [Load balancing and horizontal scaling](09-scaling-and-load-balancing.md) | What blocks a second replica today; nginx + N replicas (planned) |
| 10 | [Observability](10-observability.md) | Logs that exist today; OpenTelemetry, Prometheus, Grafana, Tempo, Loki (planned) |
| 11 | [Failure modes](11-failure-modes.md) | What breaks, what the user sees, how the system degrades |
| 12 | [Trade-offs and "why not"](12-trade-offs.md) | Why Stripe Connect separate charges, why no MongoDB, why no microservices |
| 13 | [Exercises for the reader](13-exercises.md) | Hands-on changes to try, from small to hard |

## Built vs planned

This is a learning project. Some pages describe parts that **do not exist yet**. They are always marked:

> **Planned (Phase 21/22).** Described design only, not in the code.

Phase 21 (Redis cache, BullMQ queues, nginx in front of 2+ replicas) and Phase 22 (OpenTelemetry, Prometheus,
Grafana, Tempo, Loki) are listed in [PLAN.md](../../PLAN.md). Everything not marked "planned" is in the repository today.

## Where the rest of the documentation lives

- [PLAN.md](../../PLAN.md): scope, decision log (D1–D23), phase checklist.
- [docs/](../README.md): the operational guides this guide builds on (architecture, database, payments, security…).
