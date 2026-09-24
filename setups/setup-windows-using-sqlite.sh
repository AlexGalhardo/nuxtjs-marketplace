#!/usr/bin/env bash
# Idempotent setup for local development using SQLite. Run from Git Bash on Windows.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
# shellcheck source=setups/lib.sh
source "$SCRIPT_DIR/lib.sh"

log "Nuxt Marketplace — Windows setup (SQLite)"

require_command bun "Install it from https://bun.sh (winget install Oven-sh.Bun), then restart Git Bash"

ensure_env_file "$ROOT_DIR"
set_env_var "$ROOT_DIR/.env" NUXT_HUB_DB_DIALECT sqlite

install_deps
prepare_db sqlite
print_next_steps
