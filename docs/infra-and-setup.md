# Infrastructure & setup

## Environments

| Mode | DB | Blob | How |
|------|----|------|-----|
| Local SQLite | SQLite file `.data/db/sqlite.db` | fs `.data/blob` | `setups/setup-*-using-sqlite.sh` |
| Local Postgres | PostgreSQL installed on the host | fs | `setups/setup-*-using-postgres-local.sh` |
| Docker Postgres | PostgreSQL + SeaweedFS containers | S3 (SeaweedFS) | `setups/setup-*-using-postgres-with-docker.sh` |
| Production | Managed or containerized PostgreSQL | S3-compatible | Docker image from GHCR |

## Quick start

```bash
# macOS/Linux, SQLite (fastest path)
./setups/setup-unix-using-sqlite.sh

# macOS/Linux, PostgreSQL already installed on the host
./setups/setup-unix-using-postgres-local.sh

# macOS/Linux, PostgreSQL + SeaweedFS S3 in Docker (app still runs on the host)
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
- `infra/docker-compose.yml`: full stack (`migrate` one-shot, `app` with uploads on the `app-data` volume, `postgres`, `stripe-cli`) for a
  containerized run: `docker compose -f infra/docker-compose.yml up -d --build`.
- `infra/docker-compose.dev.yml`: services only (`postgres`, `s3`, `stripe-cli`); the app runs
  on the host with `bun run dev`. `stripe-cli` forwards to `host.docker.internal:3000`.
- `setups/lib.sh`: shared helpers (`log`, `require_command`, `ensure_env_file`, `set_env_var`,
  `install_deps`, `prepare_db`, `print_next_steps`) sourced by every `setups/*.sh` script.
- `setups/*.sh`: idempotent Bash scripts, one per environment. Windows versions target **Git
  Bash** (winget-installed Bun, Docker Desktop with WSL2 integration, `psql.exe` on `PATH`).

## Production requirement: TLS reverse proxy

The app speaks plain HTTP on port 3000 and sends HSTS, so production runs behind a reverse proxy that
terminates TLS **and overwrites `X-Real-IP` with the peer address**. Rate limits and security logs key on
that header (`nuxt.config.ts` → `security.rateLimiter.ipHeader`), because Nitro's Bun server doesn't expose
the socket address and `X-Forwarded-For` is client-spoofable. Without the proxy, every client shares one
rate-limit bucket per route. Examples: Caddy `reverse_proxy app:3000 { header_up X-Real-IP {remote_host} }`;
nginx `proxy_set_header X-Real-IP $remote_addr;`. Keep port 3000 unreachable from the internet.

## CI/CD (GitHub Actions)

- `ci.yml` (push to `main`, every PR), three parallel jobs on Bun 1.4.2 with the Bun cache:
  - `checks`: ShellCheck (`setups/*.sh`) → `biome ci` → typecheck → unit tests with the 80% coverage gate → Nuxt component tests.
  - `integration`: `db:migrate` → `db:seed` → `test:integration`, matrix `sqlite` / `postgresql` (Postgres 18 service).
  - `e2e`: Playwright Chromium → migrate/seed → one `build` → smoke → e2e (`PLAYWRIGHT_SKIP_BUILD=1`); the HTML report is uploaded when it fails.
- `commitlint.yml` (PRs): every commit in the PR and the PR title (squash-merge message) against `commitlint.config.js`.
- `release.yml` (`v*.*.*` tags pushed by `bun run release`): GitHub Release from the tag's `CHANGELOG.md`
  section (`changelogen gh release`), then `ghcr.io/alexgalhardo/nuxtjs-marketplace:<version>`/`latest` and
  `:<version>-migrate`/`latest-migrate` (the Dockerfile's `migrate` target).
- `deploy.yml` (manual, `version` input): SSH to the server, `git pull`, then
  `APP_VERSION=<version> docker compose -f infra/docker-compose.yml pull migrate app && … up -d app`
  (migrations run before the app starts). Needs the `production` environment secrets `DEPLOY_HOST`,
  `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_PATH` (a checkout with the production `.env` in `infra/`).
- `.github/dependabot.yml`: weekly Bun (minor/patch grouped), GitHub Actions and Docker base image updates.
- Workflows are linted with `actionlint` (`docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:latest`).
