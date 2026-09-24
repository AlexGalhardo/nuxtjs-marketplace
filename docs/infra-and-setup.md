# Infrastructure & setup (planned — Phases 2 and 13)

## Environments

| Mode | DB | Blob | How |
|------|----|------|-----|
| Local SQLite | SQLite file `.data/db/sqlite.db` | fs `.data/blob` | `setups/setup-*-using-sqlite.sh` |
| Local Postgres | PostgreSQL installed on the host | fs | `setups/setup-*-using-postgres-local.sh` |
| Docker Postgres | PostgreSQL + MinIO containers | S3 (MinIO) | `setups/setup-*-using-postgres-with-docker.sh` |
| Production | Managed or containerized PostgreSQL | S3-compatible | Docker image from GHCR |

## Files

- `infra/docker/Dockerfile`: multi-stage build on `oven/bun:1.4.2`, runs `.output/server/index.mjs` as non-root.
- `infra/docker-compose.yml`: full stack (app, postgres, minio, stripe-cli).
- `infra/docker-compose.dev.yml`: services only (postgres, minio, stripe-cli); the app runs on the host with `bun run dev`.
- `setups/*.sh`: idempotent bash scripts. Windows versions target **Git Bash** (use `cmd //c` / `.exe` shims where needed).

## CI/CD (GitHub Actions)

- `ci.yml` on PR/push: Biome → typecheck → unit → integration (sqlite + postgres matrix) → build → smoke → e2e.
- `release.yml` on `v*.*.*` tags: GitHub Release + Docker image pushed to `ghcr.io/alexgalhardo/nuxtjs-marketplace`.
- `deploy.yml` (manual): SSH into the host and `docker compose pull && docker compose up -d`.
