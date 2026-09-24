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
| Testing | Vitest + `@nuxt/test-utils`, Playwright via `@nuxt/test-utils/playwright` | yes (test-utils) |
| TypeScript | 6.0.x (TS 7 breaks `vue-tsc` 3.3 — see PLAN.md D17) | — |

## Exceptions (no official Nuxt equivalent) — keep in sync with PLAN.md §2

`stripe`, `resend`, `zod`, `@scalar/api-reference`, `@biomejs/biome`, `husky`, `@commitlint/*`,
`@playwright/test`, `changelogen` (UnJS). Proposed: `nuxt-security` (community module).
Before adding any other non-official library: document it in PLAN.md and ask the project owner.

## AI tooling for agents

- MCP servers in `.mcp.json`: Nuxt docs (`https://nuxt.com/mcp`), Nuxt UI (`https://ui.nuxt.com/mcp`).
- Skills in `.claude/skills/` (tracked by `skills-lock.json`, install with `npx skills add`):
  - `nuxt-ui`: component usage, theming, forms.
  - `web-design-guidelines`: audit UI files for accessibility/UX. Run on every UI change.
  - `agent-browser`: drive a real browser for exploratory QA.
  - `find-skills`: discover more skills (`npx skills find <query>`).
