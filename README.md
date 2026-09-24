# Nuxt Marketplace

A simplified marketplace (MercadoLivre-style) where anyone can buy and sell **physical** and **digital** products.
Built to learn [Nuxt](https://nuxt.com) and its ecosystem.

**Status:** Phase 0 (bootstrap). See [PLAN.md](PLAN.md) for scope, decisions and progress.

## Stack

Bun · Nuxt 4 · Nuxt UI 4 · Tailwind CSS 4 · NuxtHub (Drizzle, SQLite/PostgreSQL, Blob) · nuxt-auth-utils ·
Stripe Connect · Vitest · Playwright · Biome · GitHub Actions · Docker.

## Getting started

Requirements: [Bun 1.4.2+](https://bun.sh).

```bash
bun install
bun run dev
```

Open http://localhost:3000. Setup scripts for SQLite/PostgreSQL (Windows and Unix) will be in [`setups/`](setups/)
(Phase 2).

## Documentation

- [PLAN.md](PLAN.md): the plan and checklist
- [docs/](docs/README.md): architecture and guides (written for AI agents and humans)
- [CLAUDE.md](CLAUDE.md) / [AGENTS.md](AGENTS.md): agent entry point
