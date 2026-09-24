# Tech stack

Always use the latest **stable** version, pinned as `^x.y.z` in `package.json` (never `latest`).
Check with `npm view <pkg> version` before adding a dependency.

| Area | Choice | Official Nuxt ecosystem? |
|------|--------|--------------------------|
| Runtime / package manager | Bun 1.4.2 (fallback to Node only for unsupported steps — log it in PLAN.md) | — |
| Framework | Nuxt 4.5.x | yes |
| UI | Nuxt UI 4.x + Tailwind CSS 4.x | yes |
| Database | NuxtHub DB (`@nuxthub/core`) + Drizzle ORM, SQLite / PostgreSQL | yes |
| File storage | NuxtHub Blob (fs / S3 / MinIO) | yes |
| Images | `@nuxt/image` | yes |
| Auth | `nuxt-auth-utils` | yes |
| Security | `nuxt-security` (headers, CSP, rate limit) | community module (approved) |
| Validation | Zod 4 | no (approved) |
| Testing | Vitest 5 + `@nuxt/test-utils` 4, Playwright via `@nuxt/test-utils/playwright` | yes (test-utils) |
| Lint/format, hooks | Biome 2.5, Husky 9, commitlint, changelogen | no (required by brief) |
| TypeScript | 6.0.x (TS 7 breaks `vue-tsc` 3.3 — see PLAN.md D17) | — |

## Exceptions (no official Nuxt equivalent) — keep in sync with PLAN.md §2

`stripe`, `resend`, `zod`, `nuxt-security` (community module), `@scalar/api-reference`, `@biomejs/biome`,
`husky`, `@commitlint/*`, `@playwright/test`, `changelogen` (UnJS). All approved by the owner.
Before adding any other non-official library: document it in PLAN.md and ask the project owner.

## AI tooling for agents

- MCP servers in `.mcp.json`: Nuxt docs (`https://nuxt.com/mcp`), Nuxt UI (`https://ui.nuxt.com/mcp`).
- Skills in `.claude/skills/`. **Loading the matching skill before any UI/frontend work is mandatory** (CLAUDE.md).
  Installed with `npx skills add` (tracked by `skills-lock.json`):
  - `nuxt-ui`: component usage, theming, forms.
  - `web-design-guidelines`: audit UI files for accessibility/UX. Run on every UI change.
  - `agent-browser`: drive a real browser for exploratory QA.
  - `find-skills`: discover more skills (`npx skills find <query>`).

  Vendored by hand on 2026-09-24 (content reviewed before copying — OWASP A03; update by re-copying from the same
  path and re-reviewing):

  | Skill | Use | Source (path @ commit) | License |
  |-------|-----|------------------------|---------|
  | `impeccable` | Umbrella design skill: redesign, critique, audit, polish, typeset, layout… | `pbakaus/impeccable` `.claude/skills/impeccable` @ `edb9c7f` | Apache-2.0 |
  | `frontend-design` | Landing / marketing pages: distinctive direction, type, copy | `anthropics/claude-code` `plugins/frontend-design/skills/frontend-design` @ `684ffc4` | see `LICENSE.txt` |
  | `interface-design` | Product UI: seller dashboard, forms, settings, admin | `Dammyjay93/interface-design` `.claude/skills/interface-design` @ `2f9be32` | MIT |
  | `ponytail` (+ `-audit`, `-review`, `-debt`, `-gain`, `-help`) | Least code that works (YAGNI, reuse, stdlib/native first) | `DietrichGebert/ponytail` `skills/*` @ `e3ba2aa` (from ponytail.dev) | MIT |
  | `graphify` | Codebase knowledge graph for architecture questions | `Graphify-Labs/graphify` `graphify/skill.md` + `graphify/skills/claude/references` @ `4c73561` | see `LICENSE` |

  Not installed on purpose: ponytail's session hooks (the plugin's `hooks/`), graphify's `PreToolUse` hooks, and
  impeccable's design-detector hook — they rewrite `.claude/settings.json`; enable them explicitly if wanted.
  `impeccable`'s launcher (`scripts/impeccable`) downloads a prebuilt binary on first run; agents use the skill's
  documented "launcher unavailable" fallback (read `PRODUCT.md` + `docs/design-system.md` directly) unless the owner
  approves running it. `graphify` needs its Python CLI (`graphifyy`, installed by the skill on first use) and writes
  `graphify-out/` (gitignored).
