#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  Circuit Retail ERP — Docker entrypoint
#
#  Boot sequence:
#    1. ensure runtime directories exist (db, backups)
#    2. sync the SQLite schema via `prisma db push` — guarded, see below
#    3. exec the production server (exec → PID 1, clean signal handling)
#
#  Schema-sync guard: db push is deliberately run WITHOUT --accept-data-loss.
#  On a fresh/empty database it creates all tables without prompting; but if
#  a schema change would destroy existing data (dropped tables/columns), the
#  CLI refuses in non-interactive environments (or asks an operator on an
#  attached TTY). Destructive migrations therefore fail loudly instead of
#  silently wiping shop data. A failure exits non-zero so orchestration
#  surfaces it in logs/restarts.
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

echo "[entrypoint] Circuit Retail ERP starting…"

# 1. Runtime directories (idempotent). /app/db backs the default
#    DATABASE_URL=file:/app/db/custom.db; /app/backups is where operator
#    backups land. Fresh deployments start with an EMPTY database (schema
#    only, no rows) — seed via the SEED_TOKEN-protected POST /api/seed, or
#    run scripts/seed.ts from the host against the mounted volume.
mkdir -p /app/db /app/backups

# 1b. If DATABASE_URL was overridden to another absolute file: path, try to
#     create its directory too (best-effort — prisma reports real errors if
#     the location is genuinely unusable).
db_url="${DATABASE_URL:-}"
case "${db_url}" in
  file:/*)
    db_dir="$(dirname "${db_url#file:}")"
    mkdir -p "${db_dir}" 2>/dev/null || true
    ;;
esac

# 2. Schema sync. Requires DATABASE_URL in the container environment (set in
#    the image and/or docker-compose). --skip-generate: the client is already
#    generated inside the image; only the database needs syncing.
echo "[entrypoint] Syncing database schema: prisma db push --skip-generate"
if ! ./node_modules/.bin/prisma db push --skip-generate; then
  echo "[entrypoint] ERROR: prisma db push failed — refusing to start." >&2
  echo "[entrypoint] Likely cause: a schema change would destroy existing" >&2
  echo "[entrypoint] data (or DATABASE_URL is unreachable). Inspect the" >&2
  echo "[entrypoint] prisma output above; migrate deliberately from the" >&2
  echo "[entrypoint] host if needed." >&2
  exit 1
fi

# 3. Hand off to the app server. `exec` replaces this shell (PID 1), so
#    SIGTERM reaches the server directly for clean shutdowns. -H 0.0.0.0
#    binds all interfaces so the port mapping reaches the app.
exec node node_modules/next/dist/bin/next start -H 0.0.0.0 -p "${PORT:-3000}"
