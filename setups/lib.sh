#!/usr/bin/env bash
# Shared helpers for setups/*.sh. Sourced, not executed directly.

log() { printf '\n\033[1;34m==>\033[0m %s\n' "$1"; }
warn() { printf '\033[1;33mwarning:\033[0m %s\n' "$1" >&2; }
die() {
  printf '\033[1;31merror:\033[0m %s\n' "$1" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "$1 is required but not installed. $2"
}

# ensure_env_file <root_dir> — copies .env.example to .env unless .env already exists.
ensure_env_file() {
  local root_dir="$1"
  if [ -f "$root_dir/.env" ]; then
    log ".env already exists, skipping creation (idempotent)"
  else
    cp "$root_dir/.env.example" "$root_dir/.env"
    log "Created .env from .env.example"
  fi
}

# set_env_var <env_file> <key> <value> — replaces an existing KEY=value line or appends one.
set_env_var() {
  local env_file="$1" key="$2" value="$3" tmp
  tmp="$(mktemp)"
  if grep -q "^${key}=" "$env_file" 2>/dev/null; then
    awk -v k="$key" -v v="$value" 'BEGIN{FS=OFS="="} $1==k{$0=k"="v} {print}' "$env_file" >"$tmp"
  else
    cp "$env_file" "$tmp"
    printf '%s=%s\n' "$key" "$value" >>"$tmp"
  fi
  mv "$tmp" "$env_file"
}

install_deps() {
  log "Installing dependencies with Bun"
  bun install
}

# prepare_db <dialect> — runs migrations then the dev seed for the given dialect.
prepare_db() {
  local dialect="$1"
  log "Running database migrations ($dialect)"
  NUXT_HUB_DB_DIALECT="$dialect" bun run db:migrate
  log "Seeding database"
  NUXT_HUB_DB_DIALECT="$dialect" bun run db:seed
}

print_next_steps() {
  log "Setup complete. Next steps:"
  echo "  1. Review the generated .env file and fill in Stripe/Resend keys."
  echo "  2. Start the dev server: bun run dev"
  echo "  3. Open http://localhost:3000"
}
