# Folder structure

Follows Nuxt 4 defaults. Do not invent new top-level patterns (no `services/`, `repositories/`, DI).

```
.
├─ app/                       # Vue app (srcDir)
│  ├─ app.vue / app.config.ts / error.vue
│  ├─ assets/css/main.css     # Tailwind v4 + Nuxt UI imports and theme tokens
│  ├─ components/             # Auto-imported; group by domain: Product/, Shop/, Cart/, Auth/
│  ├─ composables/            # useCart, useMoney, ... (auto-imported)
│  ├─ layouts/                # default, auth, dashboard
│  ├─ middleware/             # auth, guest, admin (route middleware)
│  └─ pages/                  # File-based routes (see PLAN.md §4)
├─ server/
│  ├─ api/                    # /api/** handlers. REST API for shops under api/v1/
│  ├─ routes/                 # Non-/api routes (e.g. images/[...pathname].get.ts)
│  ├─ middleware/             # Auth context resolution
│  ├─ plugins/                # Nitro plugins (env validation)
│  ├─ tasks/                  # Nitro tasks (db:seed)
│  ├─ utils/                  # Auto-imported server helpers (auth, stripe, email, logTransaction)
│  └─ db/                     # schema.sqlite.ts, schema.postgresql.ts, migrations/{dialect}/
├─ shared/
│  ├─ schemas/                # Zod schemas (forms + API validation) — explicit imports only;
│  │                          # Nuxt does not auto-import this subfolder (only utils/ and types/)
│  ├─ types/                  # Shared TS types — auto-imported (ambient, both app AND server)
│  └─ utils/                  # Pure functions (money, slug, pricing/fee math) — auto-imported
├─ tests/{unit,nuxt,integration,smoke,e2e}/   # see docs/testing.md
├─ public/                    # Static files
├─ docs/  infra/  setups/  .github/
├─ .claude/skills/            # Project agent skills (committed)
└─ PLAN.md  CLAUDE.md  AGENTS.md
```

## Naming
- Files: `kebab-case` for server routes and utils; `PascalCase.vue` for components; pages follow URLs.
- API handlers use method suffixes: `index.get.ts`, `[id].patch.ts`, `index.post.ts`.
