# Nuxt Marketplace — Agent Guide

> `CLAUDE.md` and `AGENTS.md` are identical. Edit both together (keep ≤ 50 lines).

Marketplace (MercadoLivre-like) to buy/sell physical and digital products. Nuxt 4 + Nuxt UI + Stripe Connect.

## Start here
1. Read [PLAN.md](PLAN.md): scope, decision log, phase checklist. Tick `[x]` and add to Change History as you work.
2. Read the relevant guide in [docs/](docs/README.md) before touching an area.

## Non-negotiables
- **English only**: code, comments, UI copy, URLs, docs, commits.
- **Bun** is the runtime/package manager (`bun install`, `bun run <script>`, `bunx`). Node only as a documented fallback.
- **Latest stable** versions, pinned `^x.y.z`. Official Nuxt ecosystem libs first; anything else must be
  listed in PLAN.md §2 and approved by the owner. See [docs/tech-stack.md](docs/tech-stack.md).
- **Nuxt conventions only** (auto-imports, `server/utils`, `shared/`, `useFetch`). See [docs/folder-structure.md](docs/folder-structure.md).
- **Nuxt UI components + Tailwind v4** for all UI. See [docs/ui-ux-frontend.md](docs/ui-ux-frontend.md).
- **Money = integer cents (USD)**; every money event goes to append-only `transaction_logs`. See [docs/payments-stripe.md](docs/payments-stripe.md).
- **Conventional Commits + SemVer**; never `--no-verify`, never push without the owner's OK. See [docs/git-workflow.md](docs/git-workflow.md).
- **Tests with every feature** (unit, integration, smoke, e2e). See [docs/testing.md](docs/testing.md).

## Guides
- Architecture: [docs/architecture.md](docs/architecture.md) · Conventions: [docs/coding-conventions.md](docs/coding-conventions.md)
- Database (SQLite + Postgres dual schema): [docs/database.md](docs/database.md)
- Auth & API tokens: [docs/authentication.md](docs/authentication.md) · REST API: [docs/rest-api.md](docs/rest-api.md)
- Infra, setup scripts, CI/CD: [docs/infra-and-setup.md](docs/infra-and-setup.md) · Env vars: [docs/environment-variables.md](docs/environment-variables.md)

## Commands
- `bun install` · `bun run dev` · `bun run build` · `bun run typecheck`
- Lint/test scripts are added in Phase 1 (see PLAN.md).

## AI tooling
- MCP (`.mcp.json`): `nuxt` (docs) and `nuxt-ui` (components). Prefer them over guessing APIs.
- Skills (`.claude/skills/`): `nuxt-ui`, `web-design-guidelines` (audit every UI change),
  `agent-browser` (exploratory QA), `find-skills`.
