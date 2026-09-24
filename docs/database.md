# Database (planned — Phase 3)

- NuxtHub DB (`@nuxthub/core`) with Drizzle ORM. Import: `import { db, schema } from '@nuxthub/db'`.
- Dialect is fixed **at build time** by `NUXT_HUB_DB_DIALECT` = `sqlite` (default) | `postgresql`.
  - SQLite: local file `.data/db/sqlite.db`, zero setup.
  - PostgreSQL: `DATABASE_URL` (docker-compose or local install).
- Two schema files that MUST stay in sync: `server/db/schema.sqlite.ts` and `server/db/schema.postgresql.ts`.
  A unit test compares their tables/columns. When changing one, change the other in the same commit.
- Migrations: `server/db/migrations/{sqlite,postgresql}/`, generated with `bun run db:generate`
  (for both dialects), applied automatically by NuxtHub on dev/build or via `bun run db:migrate`.
- Conventions: `snake_case` columns, text UUIDv7 `id`, `created_at`/`updated_at` timestamps,
  money as integer `*_cents`, enums as text + TS union types.
- `transaction_logs` and `audit_logs` are **append-only**: insert only, never update or delete.
- Seed: Nitro task `db:seed` (product types always; demo data only when `NODE_ENV !== 'production'`).

Table list: see PLAN.md §3.4.
