#!/usr/bin/env bash
# Idempotent setup for local development using a PostgreSQL server installed on the host.
# Run from Git Bash on Windows; requires psql.exe on PATH.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
# shellcheck source=setups/lib.sh
source "$SCRIPT_DIR/lib.sh"
start_session_log "$ROOT_DIR"

log "Nuxt Marketplace — Windows setup (local PostgreSQL)"

require_command bun "Install it from https://bun.sh (winget install Oven-sh.Bun), then restart Git Bash"
require_command psql "Install PostgreSQL for Windows: https://www.postgresql.org/download/windows/ and add its bin/ folder to PATH"

DB_NAME="${DB_NAME:-marketplace}"
DB_USER="${DB_USER:-postgres}"
DATABASE_URL_DEFAULT="postgres://${DB_USER}@localhost:5432/${DB_NAME}"

if psql -U "$DB_USER" -lqt 2>/dev/null | cut -d '|' -f1 | grep -qw "$DB_NAME"; then
  log "Database '$DB_NAME' already exists, skipping creation (idempotent)"
else
  log "Creating database '$DB_NAME'"
  createdb -U "$DB_USER" "$DB_NAME"
fi

ensure_env_file "$ROOT_DIR"
set_env_var "$ROOT_DIR/.env" NUXT_HUB_DB_DIALECT postgresql
set_env_var "$ROOT_DIR/.env" DATABASE_URL "${DATABASE_URL:-$DATABASE_URL_DEFAULT}"

install_deps
prepare_db postgresql
print_next_steps
run_app "$ROOT_DIR"
