# Infrastructure & setup

## Environments

| Mode | DB | Blob | How |
|------|----|------|-----|
| Local SQLite | SQLite file `.data/db/sqlite.db` | fs `.data/blob` | `setups/setup-*-using-sqlite.sh` |
| Local Postgres | PostgreSQL installed on the host | fs | `setups/setup-*-using-postgres-local.sh` |
| Docker Postgres | PostgreSQL + MinIO containers | S3 (MinIO) | `setups/setup-*-using-postgres-with-docker.sh` |
| Production | Managed or containerized PostgreSQL | S3-compatible | Docker image from GHCR |

## Quick start

```bash
# macOS/Linux, SQLite (fastest path)
./setups/setup-unix-using-sqlite.sh

# macOS/Linux, PostgreSQL already installed on the host
./setups/setup-unix-using-postgres-local.sh

# macOS/Linux, PostgreSQL + MinIO in Docker (app still runs on the host)
./setups/setup-unix-using-postgres-with-docker.sh

# Windows (Git Bash), same three flavors
./setups/setup-windows-using-sqlite.sh
./setups/setup-windows-using-postgres-local.sh
./setups/setup-windows-using-postgres-with-docker.sh
```

Every script is idempotent: it creates `.env` from `.env.example` only if missing, reuses an
existing database/containers, and can be re-run safely after a `git pull`. All of them finish by
running `bun run db:migrate` and `bun run db:seed`, then print the next manual steps (fill in
Stripe/Resend keys, `bun run dev`).

## Files

- `infra/docker/Dockerfile`: multi-stage build on `oven/bun:1.4.2` — installs deps, runs
  `bun run build`, then copies only `.output/` into a non-root (`nuxt:1001`) runtime layer.
  Includes a `HEALTHCHECK` against `GET /api/health`.
- `infra/docker-compose.yml`: full stack (`app`, `postgres`, `minio`, `stripe-cli`) for a
  containerized run: `docker compose -f infra/docker-compose.yml up -d --build`.
- `infra/docker-compose.dev.yml`: services only (`postgres`, `minio`, `stripe-cli`); the app runs
  on the host with `bun run dev`. `stripe-cli` forwards to `host.docker.internal:3000`.
- `setups/lib.sh`: shared helpers (`log`, `require_command`, `ensure_env_file`, `set_env_var`,
  `install_deps`, `prepare_db`, `print_next_steps`) sourced by every `setups/*.sh` script.
- `setups/*.sh`: idempotent Bash scripts, one per environment. Windows versions target **Git
  Bash** (winget-installed Bun, Docker Desktop with WSL2 integration, `psql.exe` on `PATH`).

## CI/CD (GitHub Actions) — planned, Phase 13

- `ci.yml` on PR/push: ShellCheck (`setups/*.sh`, `setups/lib.sh`) → Biome → typecheck → unit →
  integration (sqlite + postgres matrix) → build → smoke → e2e.
- `release.yml` on `v*.*.*` tags: GitHub Release + Docker image pushed to
  `ghcr.io/alexgalhardo/nuxtjs-marketplace`.
- `deploy.yml` (manual): SSH into the host and `docker compose pull && docker compose up -d`.
