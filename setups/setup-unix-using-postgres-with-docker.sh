#!/usr/bin/env bash
# Idempotent setup for local development using PostgreSQL + SeaweedFS S3 in Docker (macOS/Linux).
# The app itself runs on the host with `bun run dev` (see infra/docker-compose.dev.yml).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
# shellcheck source=setups/lib.sh
source "$SCRIPT_DIR/lib.sh"
start_session_log "$ROOT_DIR"

log "Nuxt Marketplace — Unix setup (PostgreSQL + SeaweedFS S3 via Docker)"

require_command bun "Install it from https://bun.sh"
require_command docker "Install Docker: https://docs.docker.com/get-docker/"
docker compose version >/dev/null 2>&1 || die "Docker Compose v2 is required (bundled with recent Docker Desktop/Engine)"

ensure_env_file "$ROOT_DIR"
set_env_var "$ROOT_DIR/.env" NUXT_HUB_DB_DIALECT postgresql
set_env_var "$ROOT_DIR/.env" DATABASE_URL "postgres://marketplace:marketplace@localhost:5432/marketplace"
set_env_var "$ROOT_DIR/.env" S3_ACCESS_KEY_ID resell
set_env_var "$ROOT_DIR/.env" S3_SECRET_ACCESS_KEY resell-secret
set_env_var "$ROOT_DIR/.env" S3_BUCKET marketplace
set_env_var "$ROOT_DIR/.env" S3_REGION us-east-1
set_env_var "$ROOT_DIR/.env" S3_ENDPOINT http://localhost:9000

log "Starting postgres + s3 + stripe-cli containers"
docker compose -f "$ROOT_DIR/infra/docker-compose.dev.yml" up -d

log "Waiting for PostgreSQL to be healthy"
until docker compose -f "$ROOT_DIR/infra/docker-compose.dev.yml" ps postgres --format '{{.Health}}' | grep -q "healthy"; do
  sleep 2
done

install_deps
prepare_db postgresql
print_next_steps
run_app "$ROOT_DIR"
