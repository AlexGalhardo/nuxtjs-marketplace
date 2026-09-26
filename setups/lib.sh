#!/usr/bin/env bash
# Shared helpers for setups/*.sh. Sourced, not executed directly.

log() { printf '\n\033[1;34m==>\033[0m %s\n' "$1"; }
warn() { printf '\033[1;33mwarning:\033[0m %s\n' "$1" >&2; }
die() {
  printf '\033[1;31merror:\033[0m %s\n' "$1" >&2
  exit 1
}

# start_session_log <root_dir> — mirrors everything the script and the app print to
# logs/<script>-<timestamp>.log, and keeps the terminal open when the script ends. Double-clicking a
# .sh on Windows opens Git Bash, which closes its window as soon as the script exits (or fails), so
# without this the output was lost. Call it right after sourcing this file.
start_session_log() {
  local root_dir="$1"
  mkdir -p "$root_dir/logs"
  SESSION_LOG="$root_dir/logs/$(basename "$0" .sh)-$(date +%Y%m%d-%H%M%S).log"
  # tee ignores Ctrl+C so it keeps writing after the app is stopped.
  exec > >(
    trap '' INT
    tee -a "$SESSION_LOG"
  ) 2>&1
  # A no-op handler (not `trap '' INT`, which children would inherit): Ctrl+C stops the app,
  # then the EXIT trap below still runs.
  trap ':' INT
  trap 'end_session $?' EXIT
  log "Logging to $SESSION_LOG"
}

end_session() {
  local status="$1"
  echo
  if [ "$status" -eq 0 ] || [ "$status" -eq 130 ]; then
    log "Finished. Full log: $SESSION_LOG"
  else
    printf '\033[1;31mSetup failed (exit code %s).\033[0m Full log: %s\n' "$status" "$SESSION_LOG"
  fi
  if [ -t 0 ]; then
    read -r -p "Press Enter to close this window..." _ || true
  fi
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
  log "Setup complete."
  echo "  - Review the generated .env file and fill in Stripe/Resend keys (restart this script after)."
  echo "  - The app starts below: open http://localhost:3000 once it says it's listening."
  echo "  - Its logs stream here and into $SESSION_LOG. Press Ctrl+C to stop it."
}

# run_app <root_dir> — starts the dev server in the foreground so its logs stay on screen (and in
# the log file).
run_app() {
  log "Starting the app (bun run dev)"
  cd "$1" || die "Cannot enter $1"
  bun run dev
}
