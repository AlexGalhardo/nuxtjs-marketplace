# resell.sh

A lowercase, terminal-green marketplace (Enjoei-inspired) where anyone can buy and sell **physical** and
**digital** products: one multi-seller cart, one Stripe Checkout, payouts to every seller through Stripe Connect.
Built to learn [Nuxt](https://nuxt.com) and its ecosystem.

**Status:** v1.0.0 — every phase in [PLAN.md](PLAN.md) is complete. Owner-only setup (keys, secrets, the
reverse proxy) is listed at the end of PLAN.md.

## What it does

- **Buyers:** search and filter the catalog, multi-seller cart, Stripe Checkout, order tracking, expiring
  download links for digital goods, verified-buyer reviews.
- **Sellers:** a shop at `/my-shop` with products, photos and private files, Stripe Connect onboarding, order
  fulfilment and refunds, personal API tokens plus an OpenAPI/Scalar reference for a public REST API.
- **Admins:** moderation (suspend shops and products), users, transaction logs with CSV export, audit log.

## Stack

Bun · Nuxt 4 · Nuxt UI 4 · Tailwind CSS 4 · NuxtHub (Drizzle, SQLite/PostgreSQL, Blob) · nuxt-auth-utils ·
nuxt-security · Stripe Connect · Resend · Vitest · Playwright · Biome · GitHub Actions · Docker.

## Getting started

Requirements: [Bun 1.4.2+](https://bun.sh). Pick a setup script from [`setups/`](setups/) (SQLite, local
PostgreSQL, or PostgreSQL + S3 in Docker; Unix and Windows), or:

```bash
bun install
bun run db:migrate && bun run db:seed   # SQLite by default, plus a labeled demo catalog
bun run build && bun run start          # http://localhost:3000
```

For development, `bun run dev`; PLAN.md §7 tracks an open dev-server issue under Bun (production builds are unaffected).

| Command | What it does |
|---|---|
| `bun run check` / `check:fix` | Biome lint + format |
| `bun run typecheck` | `nuxt typecheck` |
| `bun run test:unit` / `test:coverage` | Unit + Nuxt component tests / unit tests with the 80% coverage gate |
| `bun run test:integration` | API tests against a built server |
| `bun run test:smoke` / `test:e2e` | Playwright |
| `bun run db:make-admin <email>` | Promote an account to admin |
| `bun run release` | Bump the version, update CHANGELOG.md, tag (pushing the tag publishes the release) |

## Deploying

Release tags build `ghcr.io/alexgalhardo/nuxtjs-marketplace:<version>` plus a `-migrate` image;
`infra/docker-compose.yml` runs migrations, then the app, on PostgreSQL. Production needs a TLS reverse proxy
that sets `X-Real-IP` (rate limits and security logs depend on it). Details:
[docs/infra-and-setup.md](docs/infra-and-setup.md).

## Documentation

- [PLAN.md](PLAN.md): scope, decisions, phase checklist, change history, open risks, owner to-dos
- [docs/](docs/README.md): architecture and guides (written for AI agents and humans)
- [CHANGELOG.md](CHANGELOG.md) · [CLAUDE.md](CLAUDE.md) / [AGENTS.md](AGENTS.md): agent entry point
