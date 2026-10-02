# resell.sh — Agent Guide

> `CLAUDE.md` and `AGENTS.md` are identical. Edit both together (keep ≤ 50 lines).

resell.sh — a lowercase, terminal-green marketplace (Enjoei-like) to buy/sell physical and digital products. Nuxt 4 + Nuxt UI + Stripe Connect.

## Start here
1. Read [PLAN.md](PLAN.md): scope, decisions, phase checklist (the task state). Tick `[x]` as you work.
2. Read the relevant guide in [docs/](docs/README.md) and the matching [.claude/rules/](.claude/rules/) file.
3. Log every change under `[Unreleased]` in [CHANGELOG.md](CHANGELOG.md) (Keep a Changelog).

## Non-negotiables
- **English only**: code, comments, UI copy, URLs, docs, commits.
- **Bun** is the runtime/package manager (`bun install`, `bun run <script>`, `bunx`). Node only as a documented fallback.
- **Latest stable** versions, pinned `^x.y.z`. Official Nuxt ecosystem libs first; anything else must be
  listed in PLAN.md §2 and approved by the owner. See [docs/tech-stack.md](docs/tech-stack.md).
- **Nuxt conventions only** (auto-imports, `server/utils`, `shared/`, `useFetch`). See [docs/folder-structure.md](docs/folder-structure.md).
- **resell.sh design system** ([docs/design-system.md](docs/design-system.md)): Enjoei-inspired structure, lowercase,
  terminal green, light default + dark toggle. Own Tailwind v4 components for layout/marketing; Nuxt UI only for
  hard a11y primitives, re-themed. See [docs/ui-ux-frontend.md](docs/ui-ux-frontend.md).
- **Always-on skills, mandatory** for any maintenance/evolution of this code: `andrej-karpathy-skills:karpathy-guidelines`,
  `ponytail` and `graphify` (query `graphify-out/` for architecture questions; `--update` after structural changes).
- **Skills first, mandatory**: before ANY UI/UX or frontend code (new, refactor, fix), load the matching skill(s)
  from `.claude/skills/` and follow them: `impeccable` (all UI), `frontend-design` (landing/marketing),
  `interface-design` (dashboards/forms/app UI), plus `nuxt-ui` and `web-design-guidelines` (audit). No skill, no edit.
- **New project skills** when a flow repeats: `.claude/skills/<name>/SKILL.md` (`skill-creator`), listed here.
- **Worktrees** for independent parallel work, on your judgment (see `.claude/rules/agent-workflow.md`).
- **Money = integer cents (USD)**; every money event goes to append-only `transaction_logs`. See [docs/payments-stripe.md](docs/payments-stripe.md).
- **Conventional Commits + SemVer**; never `--no-verify`. `dev` = sandbox, `main` = production: push `dev`, promote to
  `main` only after `dev` CI is green. See [docs/git-workflow.md](docs/git-workflow.md).
- **Tests with every feature** (unit, integration, smoke, e2e). See [docs/testing.md](docs/testing.md).
- **OWASP Top 10:2025 review** closes every phase (PLAN.md §5.1). See [docs/security.md](docs/security.md).

## Guides
- Architecture: [docs/architecture.md](docs/architecture.md) · Conventions: [docs/coding-conventions.md](docs/coding-conventions.md)
- Database (SQLite + Postgres dual schema): [docs/database.md](docs/database.md)
- Auth & API tokens: [docs/authentication.md](docs/authentication.md) · REST API: [docs/rest-api.md](docs/rest-api.md)
- Infra, setup scripts, CI/CD: [docs/infra-and-setup.md](docs/infra-and-setup.md) · Env vars: [docs/environment-variables.md](docs/environment-variables.md)

## Commands
- `bun install` · `bun run setup:sqlite|setup:postgres-local|setup:postgres-docker` · `bun run dev` · `bun run build`
- `bun run typecheck` · `bun run db:make-admin <email>` · `bun run release <patch|minor|major>`
- `bun run check` / `check:fix` (Biome) · `bun run test:unit` · `test:coverage` (80% gate) · `test:integration` · `test:smoke` · `test:e2e`
- Before finishing a task: `bun run check && bun run typecheck && bun run test:unit`.

## AI tooling
- MCP (`.mcp.json`): `nuxt` (docs) and `nuxt-ui` (components). Prefer them over guessing APIs.
- Skills (`.claude/skills/`, provenance in [docs/tech-stack.md](docs/tech-stack.md)): `impeccable`, `frontend-design`,
  `interface-design`, `ponytail` (+ `-audit/-review/-debt`), `graphify`, `nuxt-ui`, `web-design-guidelines`,
  `agent-browser` (exploratory QA), `find-skills`.
