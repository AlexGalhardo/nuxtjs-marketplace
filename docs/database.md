# Database

- NuxtHub DB (`@nuxthub/core`) with Drizzle ORM. Inside `server/**`, `db` and `schema` are
  auto-imported (the module aliases them to a generated `@nuxthub/db` package under `.nuxt/`).
  Standalone scripts that run outside the Nitro build (`server/db/seed.ts`) cannot use that
  auto-import; they build their own client via `server/db/client.ts` (`createSeedClient()`),
  using the public `createDrizzleClient` export from `@nuxthub/core/db` — the same one the
  `nuxt db migrate`/`generate` CLI commands use internally.
- Dialect is fixed **at build time**: `nuxt.config.ts` reads `NUXT_HUB_DB_DIALECT` (`sqlite`
  default | `postgresql`) directly from `process.env` and sets `hub.db` accordingly — this is a
  module option, not part of `runtimeConfig`.
  - SQLite: driver `libsql`, local file `.data/db/sqlite.db`, zero setup.
  - PostgreSQL: driver `postgres-js`, reads `DATABASE_URL` (docker-compose or local install).
- Two schema files that MUST stay in sync: `server/db/schema.sqlite.ts` (`sqliteTable`) and
  `server/db/schema.postgresql.ts` (`pgTable`) — NuxtHub globs both
  `server/db/schema.ts` and `server/db/schema.${dialect}.ts` automatically. A unit test
  (`tests/unit/db-schema-parity.test.ts`) compares their table names, column names and
  nullability. When changing one, change the other in the same commit.
- Both schema files use explicit imports (not auto-imports) for `newId()` (`shared/utils/id.ts`,
  wraps `Bun.randomUUIDv7()`) and the enum union types (`shared/types/enums.ts`), since they are
  loaded directly by the standalone seed script as well as by the Nitro build.
- Migrations: `server/db/migrations/{sqlite,postgresql}/`, generated with `bun run db:generate`
  (once per dialect, passing `NUXT_HUB_DB_DIALECT`/`DATABASE_URL`), applied with
  `bun run db:migrate`.
- Conventions: `snake_case` columns, text UUIDv7 `id` (`$defaultFn`), `created_at`/`updated_at`
  timestamps (`updated_at` auto-bumps via `$onUpdate`), money as integer `*_cents`, JSON via
  `text({mode:'json'})` (sqlite) / `jsonb()` (postgresql), enums as text + TS union types (no
  DB-level enum, validated at the app layer with Zod).
- `transaction_logs` and `audit_logs` are **append-only**: insert only, never update or delete.
- Seed: `bun run db:seed` runs `server/db/seed.ts` (a plain Bun script, not a Nitro task — Nitro's
  `task run` requires an already-running dev server, which doesn't fit idempotent one-shot setup
  scripts). It always seeds the fixed `product_types` list (D13) using `onConflictDoNothing()`
  for idempotency; outside production it also seeds the fake catalog.
- Production/Docker: Postgres builds skip NuxtHub's build-time migrations (`applyMigrationsDuringBuild: false`,
  explicit `postgres-js` driver so `DATABASE_URL` is read at run time). Migrations run through
  `bun run db:migrate` — in Docker, the `migrate` target of `infra/docker/Dockerfile` (compose runs it before `app`).
- `bun run db:make-admin <email>` (`server/db/make-admin.ts`) promotes an existing account to `admin`
  (Phase 11). The role is read into the session at login, so the user logs in again afterwards.
- `bun run db:reset` drops every table (`nuxt db drop-all --force`), re-migrates, then re-seeds.
- Shared inferred types: `shared/types/db.ts` (from the SQLite schema; parity test keeps
  PostgreSQL in sync).

Table list: see PLAN.md §3.4.
