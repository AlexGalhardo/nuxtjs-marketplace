# Infrastructure & setup

## Environments

| Mode | DB | Blob | How |
|------|----|------|-----|
| Local SQLite | SQLite file `.data/db/sqlite.db` | fs `.data/blob` | `setups/setup-*-using-sqlite.sh` |
| Local Postgres | PostgreSQL installed on the host | fs | `setups/setup-*-using-postgres-local.sh` |
| Docker Postgres | PostgreSQL + SeaweedFS containers | S3 (SeaweedFS) | `setups/setup-*-using-postgres-with-docker.sh` |
| Production (Railway) | Railway PostgreSQL | Railway bucket (S3) | `main` auto-deploys after `ci` passes (see "Production on Railway") |
| Self-hosted | Any PostgreSQL | fs volume `/app/.data` (see below) | Docker image from GHCR + `infra/docker-compose.yml` |

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
  `install_deps`, `prepare_db`, `print_next_steps`, `start_session_log`, `run_app`) sourced by every `setups/*.sh` script.
- `setups/*.sh`: idempotent Bash scripts, one per environment. Windows versions target **Git
  Bash** (winget-installed Bun, Docker Desktop with WSL2 integration, `psql.exe` on `PATH`).
  Each one ends by starting the app (`bun run dev`) in the foreground, so its logs stay on screen (Ctrl+C
  stops it); everything the script and the app print is also saved to `logs/<script>-<timestamp>.log`
  (gitignored), and the window waits for Enter before closing, on success, error or Ctrl+C, instead of
  vanishing as Git Bash does when a double-clicked script exits.

## Uploads in the Docker image

The published image stores uploads with NuxtHub's `fs` blob driver on the `/app/.data` volume, not S3.
`@nuxthub/core@0.10.8` serializes the blob driver **and its S3 credentials** into the server bundle at build
time, so a published image can't be pointed at S3 from run-time env. Production on Railway uses a private,
per-environment build with the `S3_*` build args (the Dockerfile declares them; never publish such an image).
The public GHCR image is built without them and keeps `fs`, so self-hosters back up the volume.
Local `bun run dev` with `S3_*` is unaffected.

## Production on Railway

Project `resell-sh` (environment `production`): services `Postgres`, `Redis` and `app` (2 replicas in
`us-east4`, Railway tracing on), bucket `uploads`. `REDIS_URL=${{Redis.REDIS_URL}}` on `app`.
URL: https://app-production-8586.up.railway.app

- `app` builds `infra/docker/Dockerfile` from the `main` branch with **Wait for CI** on: Railway deploys a
  commit only after its GitHub `ci` checks pass, and `main` only receives commits whose `dev` run passed (D23).
- `APP_TARGET=migrate` (build arg) makes the final image the build stage, so the pre-deploy command
  `bun run db:deploy` (migrate + seed product types) can run in it; the start command is
  `bun .output/server/index.mjs`. A failed pre-deploy or a failing `/api/health` keeps the previous
  deployment serving (zero-downtime rollback by default).
- Uploads go to the `uploads` bucket: its `S3_*` credentials are service variables that Railway passes as
  build args, baked into this private image only (see "Uploads in the Docker image").
- Railway's edge terminates TLS and sets `X-Real-IP`, which the rate limits and security logs key on.
- Variables: `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `NUXT_HUB_DB_DIALECT=postgresql`, `NUXT_SESSION_PASSWORD`,
  `NUXT_PUBLIC_SITE_URL`, `PORT=3000`, `S3_*`; Stripe and Resend keys come with PLAN.md Phase 19.
  `NUXT_STRICT_ENV=false` until the Stripe keys exist.
- Operate: `railway logs --service app`, `railway variable list --service app`, Railway MCP in Claude Code.

## Self-hosted requirement: TLS reverse proxy

The app speaks plain HTTP on port 3000 and sends HSTS, so production runs behind a reverse proxy that
terminates TLS **and overwrites `X-Real-IP` with the peer address**. Rate limits and security logs key on
that header (`nuxt.config.ts` → `security.rateLimiter.ipHeader`), because Nitro's Bun server doesn't expose
the socket address and `X-Forwarded-For` is client-spoofable. Without the proxy, every client shares one
rate-limit bucket per route. Examples: Caddy `reverse_proxy app:3000 { header_up X-Real-IP {remote_host} }`;
nginx `proxy_set_header X-Real-IP $remote_addr;`. Keep port 3000 unreachable from the internet.

## CI/CD (GitHub Actions)

- `ci.yml` (push to `main`/`dev`, every PR), four parallel jobs on Bun 1.4.2 with the Bun cache:
  - `checks`: ShellCheck (`setups/*.sh`) → `biome ci` → typecheck → unit tests with the 80% coverage gate → Nuxt component tests.
  - `integration`: `db:migrate` → `db:seed` → `test:integration`, matrix `sqlite` / `postgresql` (Postgres 18 service).
  - `docker`: builds the image (no push), so a broken Dockerfile fails before a release.
  - `e2e`: Playwright Chromium → migrate/seed → one `build` → smoke → e2e (`PLAYWRIGHT_SKIP_BUILD=1`); the HTML report is uploaded when it fails.
- `commitlint.yml` (PRs): every commit in the PR and the PR title (squash-merge message) against `commitlint.config.js`.
- `release.yml` (`v*.*.*` tags pushed by `bun run release`): GitHub Release from the tag's `CHANGELOG.md`
  section (`gh release create`), then `ghcr.io/alexgalhardo/nuxtjs-marketplace:<version>`/`latest` and
  `:<version>-migrate`/`latest-migrate` (the Dockerfile's `migrate` target).
- Deploys: Railway (above). Self-hosters pull the GHCR image: `APP_VERSION=<version> docker compose -f
  infra/docker-compose.yml pull migrate app && … up -d --wait app`.
- `deps.yml` (weekly): `bun outdated` + `bun audit` report (Dependabot can't parse `bun.lock` v2).
- `.github/dependabot.yml`: weekly GitHub Actions and Docker base image updates, PRs against `dev`.
- Workflows are linted with `actionlint` (`docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:latest`).
