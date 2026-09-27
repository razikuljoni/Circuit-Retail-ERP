# Operations Runbook

Day-to-day operational procedures for a deployed Circuit Retail ERP instance. For installation see [DEPLOYMENT.md](DEPLOYMENT.md).

## Daily operations

Two checks cover 95% of operational health:

```bash
# 1. Probe the app (expect 200 {"status":"ok", ...})
curl -fsS http://localhost:3000/api/health | head -c 400; echo

# 2. Tail logs
docker compose logs -f app          # Docker deployment
journalctl -u circuit -f            # systemd deployment
bun run dev                         # dev: dev.log is the tee'd output
```

A `503` response with `"status":"degraded"` means the database check failed — see the troubleshooting table below.

## Backups

`bun run backup` creates a consistent, compacted snapshot using SQLite's `VACUUM INTO` and then verifies it with `PRAGMA integrity_check`. It is **safe to run while the app is serving traffic** — it only reads the source database.

```bash
bun run backup
# • Source : /abs/path/db/custom.db
# ✓ Backup : backups/circuit-erp-20260927-052952.db
#   Size   : 512.0 KB
#   Verify : integrity_check = ok
```

**What `VACUUM INTO` guarantees:** the output file is a transactionally consistent copy of the database as of a single instant — never a torn state — and it is compacted (no free-page bloat). The script exits non-zero if the snapshot fails verification.

### Recommended cadence

- **Hourly** via cron, plus a daily offsite copy:

```cron
0 * * * * cd /opt/circuit-retail-erp && bun scripts/backup.ts >> backup.log 2>&1
0 2 * * * rsync -a /opt/circuit-retail-erp/backups/ backup-host:/srv/backups/circuit/
```

- **Docker note:** the container image ships node, not bun — the backup script is a host-side tool. Two options:
  1. **Simplest documented path:** run the script from a host checkout. With a named volume the db file lives under the volume mount (e.g. `/var/lib/docker/volumes/<project>_app-db/_data/db/custom.db`), so point `DATABASE_URL` at that path (or copy the file out first: `docker compose cp app:/app/db/custom.db ./` and snapshot the copy). Copying the db file while the app runs is *not* consistent on its own — always snapshot the copy with `bun scripts/backup.ts` rather than archiving the raw copy.
  2. The `app-backups` volume (`/app/backups`) is where in-container copies should be written if you adapt the tooling; snapshots there survive container recreation.

## Restore

The restore tool verifies the snapshot **before touching anything**, archives the current database (so a restore is itself reversible), copies the snapshot in place, and clears stale WAL sidecars (`-wal`, `-shm`) so the restored file isn't paired with another database's write-ahead log.

**Always stop the app first** (`docker compose stop` / `systemctl stop circuit` / Ctrl-C) so no process holds an open handle to the file being replaced:

```bash
# 1. STOP the app
docker compose stop                 # or: sudo systemctl stop circuit

# 2. Restore
bun run restore backups/circuit-erp-20260927-052952.db

# 3. START the app
docker compose up -d                # or: sudo systemctl start circuit

# 4. Verify
curl -fsS http://localhost:3000/api/health
```

After restore, spot-check real data in the UI — open `#/sales` and confirm a recent sale renders with correct totals (or create a test sale and refund it).

## Reseed demo data

Demo reseeding wipes and regenerates sample data (42 products, 30 days of sales, expenses, shifts).

**Development** — open, two ways:

- UI: `#/settings` → data tools → **Reseed**.
- API: `POST /api/seed`.

**Production** — fail-closed by default. The endpoint is disabled (403) unless `SEED_TOKEN` is set in the environment, and callers must echo it:

```bash
curl -X POST http://localhost:3000/api/seed \
  -H "x-seed-token: $SEED_TOKEN"
```

With `SEED_TOKEN` unset in production the endpoint always returns 403 — the recommended posture for a live shop. Reseeding replaces data; back up first if you want a way back.

## Schema changes

**Development flow:**

1. Edit `prisma/schema.prisma`.
2. `bun run db:push` (dev tool accepts data loss — it is not for production).
3. **Restart the dev server** (`bun run dev`). This is not optional: the in-memory `@prisma/client` does not reload after generate, and API routes 500 on new fields until restart. This bit us during development — treat it as part of the change.

**Production flow (Docker):** the container entrypoint runs `prisma db push --skip-generate` on every boot, so deploying a new image syncs the schema automatically. Additive changes apply cleanly; **destructive drift (column drops/type changes) refuses to run**, the container exits, and the conflict is in the logs — resolve it intentionally, never by forcing `--accept-data-loss` through custom entrypoint overrides.

## Common errors

| Symptom | Cause | Fix |
| --- | --- | --- |
| `EADDRINUSE :3000` | Another process holds the port (stale dev server, second instance) | Kill the stale process or change `PORT`; check with `lsof -i :3000`. |
| Prisma `P1001: can't reach database` | Bad `DATABASE_URL`, missing volume, or the file doesn't exist yet | Fix the URL (absolute path in prod), run `bun run db:push`, verify the volume mount. |
| 500s on **new** fields right after a schema change | Stale in-memory Prisma client in the running dev server | Restart the dev server. |
| `SQLITE_BUSY` / "database is locked" | Two app processes writing one SQLite file | Run exactly one app instance per db file. |
| `403` on `POST /api/seed` | Production guard: `SEED_TOKEN` unset or wrong/missing header | Send `x-seed-token: $SEED_TOKEN`, or reseed in dev; unset token = disabled (recommended in prod). |
| `/api/health` → `503 degraded` | Database check (`SELECT 1`) failed | Read `checks.database.error` in the response; verify path/volume; restore from backup if the file is corrupt. |
| Numbers "shift" at midnight | Assuming server-local time | Not an error — all day windows are Dhaka (UTC+6), computed in code; the server TZ is irrelevant. |

## Upgrading

1. **Backup**: `bun run backup` (and sync offsite).
2. **Pull**: `git pull` (review CHANGELOG.md for breaking notes).
3. **Build**: `docker compose up -d --build` — or bare metal: `bun install && bun run db:push && bun run build`.
4. **Health check**: `curl http://localhost:3000/api/health` → 200.
5. **Smoke test**: in the UI, open POS, add an item, complete a small sale, then verify it in `#/sales` and the dashboard. Refund or delete the test sale afterwards to keep data clean.

Rollback = stop the app, `bun run restore backups/<pre-upgrade>.db`, deploy the previous image/commit, start.

## Data portability

Your data is never locked in:

- **Full JSON export** — `GET /api/backup` (also in Settings → data tools) returns a complete JSON snapshot of every table.
- **CSV exports** — per-module CSV buttons (sales, products, inventory movements, expenses, customers, suppliers, statements) for spreadsheets and import into other systems.
- **The SQLite file itself** — `db/custom.db` is the single source of truth; any SQLite tool can read it, and `bun run backup`/`restore` move it safely between hosts.
