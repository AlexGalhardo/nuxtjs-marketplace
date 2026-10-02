# Contributing to resell.sh

Thanks for helping. This is a learning project: questions, fixes, docs improvements and solutions to the
[exercises](docs/system-design/13-exercises.md) are all welcome. By taking part you agree to the
[Code of Conduct](CODE_OF_CONDUCT.md).

## Setup

1. Install [Bun 1.4.2+](https://bun.sh) (Bun is the runtime and package manager; don't use npm, yarn or pnpm). On
   Windows, install Git for Windows: the setup scripts run in Git Bash.
2. Fork and clone the repository, then run one setup script:

   ```bash
   bun run setup:sqlite            # zero setup, SQLite
   bun run setup:postgres-local    # PostgreSQL installed on your machine
   bun run setup:postgres-docker   # PostgreSQL + S3 in Docker
   ```

   Or manually: `bun install`, `cp .env.example .env`, `bun run db:migrate && bun run db:seed`, `bun run dev`.
3. For payments, add Stripe **test mode** keys to `.env` and forward webhooks with
   `stripe listen --forward-to localhost:3000/api/stripe/webhook`. Never use live keys.

More: [README.md](README.md#quick-start), [docs/infra-and-setup.md](docs/infra-and-setup.md).

## Before you code

- Read [PLAN.md](PLAN.md) (scope, decision log, phase checklist) and the guide for the area you touch in
  [docs/](docs/README.md).
- For anything bigger than a small fix, open an issue first so we can agree on the approach.
- New dependencies need approval: only official Nuxt ecosystem libraries by default, anything else must be listed in
  PLAN.md §2 ([docs/tech-stack.md](docs/tech-stack.md)). Pin exact latest stable versions.
- Everything is in English: code, comments, UI copy, docs, commits.

## Branch flow

- `dev` is the integration branch; `main` is production and only receives commits whose `dev` CI run passed
  (`git push origin dev:main`, done by the maintainer).
- Create your branch from `dev` (`feat/...`, `fix/...`, `docs/...`) and open the pull request **against `dev`**.

Details: [docs/git-workflow.md](docs/git-workflow.md).

## Commits

- [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/): `type(scope): subject`, lower-case
  imperative subject, at most 72 characters. Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`,
  `build`, `ci`, `chore`, `revert`. Breaking changes: `feat!:` or a `BREAKING CHANGE:` footer.
- Husky runs `biome check --staged` on commit and commitlint on the message. Never bypass hooks with `--no-verify`;
  fix the problem instead (`bun run check:fix`).
- [SemVer](https://semver.org/): `feat` → minor, `fix`/`perf` → patch, breaking → major.

## Changelog

[CHANGELOG.md](CHANGELOG.md) follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Every user-visible change
adds one line under `## [Unreleased]` in the right section (`Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`,
`Security`), in the same commit as the change. Releases are cut by the maintainer with `bun run release`.

## Tests are required

Every feature or fix ships with tests at the right level, and every bug gets a regression test
([docs/testing.md](docs/testing.md)):

| Level | Command |
|-------|---------|
| Unit and component | `bun run test:unit` (`bun run test:coverage` enforces 80%) |
| Integration (built server, fake Stripe) | `bun run test:integration` |
| Smoke and end to end (Playwright) | `bun run test:smoke`, `bun run test:e2e` (first time: `bunx playwright install chromium`) |

Before opening a pull request, at least:

```bash
bun run check && bun run typecheck && bun run test:unit
```

plus the integration or e2e tests of the area you changed. CI runs everything (including PostgreSQL) on your PR.

## Project rules that reviews check

- Money is integer cents; the server recomputes prices; every money event goes through `logTransaction()`; Stripe
  calls that move money carry an idempotency key ([docs/payments-stripe.md](docs/payments-stripe.md)).
- Every protected handler calls an auth helper and checks ownership; inputs are validated with the shared Zod schemas
  ([docs/security.md](docs/security.md)).
- Both database schemas change together (`server/db/schema.sqlite.ts` and `server/db/schema.postgresql.ts`), with
  migrations for both dialects ([docs/database.md](docs/database.md)).
- UI follows the resell.sh design system: lowercase, terminal green, light and dark themes, accessible
  ([docs/design-system.md](docs/design-system.md), [docs/ui-ux-frontend.md](docs/ui-ux-frontend.md)).

## Using AI coding agents

The repository is set up for AI agents, and the same rules apply to their output:

- [CLAUDE.md](CLAUDE.md) and [AGENTS.md](AGENTS.md) (identical) are the entry point.
- [.claude/rules/](.claude/rules/) holds the rules agents follow on every task (workflow, money and payments, server
  security, frontend, testing).
- [.claude/skills/](.claude/skills/) holds the project skills agents load before editing (for example `ponytail` for
  minimal changes, `impeccable` and `nuxt-ui` for UI work). Provenance: [docs/tech-stack.md](docs/tech-stack.md).
- `.mcp.json` configures the official Nuxt and Nuxt UI MCP servers.

You are responsible for every line you submit, whoever wrote it.

## Security issues

Don't open a public issue for a vulnerability. Follow [SECURITY.md](SECURITY.md).
