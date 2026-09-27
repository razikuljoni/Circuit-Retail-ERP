# Deployment Guide

Production deployment for Circuit Retail ERP. The recommended path is **Docker Compose**; a bare-metal (systemd) path is documented for hosts without Docker.

For the data model and internals see [ARCHITECTURE.md](ARCHITECTURE.md); for day-2 operations see [OPERATIONS.md](OPERATIONS.md).

## Requirements

| Resource | Minimum |
| --- | --- |
| CPU | 2 vCPU |
| RAM | 2 GB |
| Disk | 5 GB (database + backups grow slowly; images are stored as compressed data URIs inside SQLite) |
| Runtime | Docker 24+ (Compose v2), **or** node ≥ 20 / pnpm ≥ 9 for bare metal |
| OS | Any supported Linux distribution |

## Option A — Docker Compose (recommended)

The stack is a single `app` service: a multi-stage image (node builder → node:22-slim runner) that syncs the Prisma schema on every boot, then serves the standalone Next.js server. Data lives in two named volumes: `app-db` (the SQLite file at `/app/db`) and `app-backups`.

### 1. Get the code and configure

```bash
git clone https://github.com/razikuljoni/Circuit-Retail-ERP.git
cd circuit-retail-erp
cp .env.example .env
```

Edit `.env`:

```ini
DATABASE_URL=file:/app/db/custom.db   # matches the container volume path
SEED_TOKEN=<long random string>       # or leave empty to disable prod seeding entirely
# NEXT_PUBLIC_APP_URL=https://pos.example.com
# APP_PORT=3000
```

### 2. Build and start

```bash
docker compose up -d --build
```

The entrypoint runs `prisma db push --skip-generate` on boot (without `--accept-data-loss`, so destructive schema drift fails loudly instead of silently dropping data), then `next start -H 0.0.0.0 -p ${PORT:-3000}`.

### 3. Verify

```bash
curl http://localhost:3000/api/health
# → 200 {"status":"ok","checks":{"database":{"status":"up",...}}}
```

### Data persistence

- The database lives in the `app-db` volume (`/app/db/custom.db` inside the container). Recreating the container keeps data; `docker compose down -v` would **delete** it.
- Backups written inside the container land in the `app-backups` volume (`/app/backups`).
- Change the host port with `APP_PORT` in `.env` (compose maps `"${APP_PORT:-3000}:3000"`).
- Logs: `docker compose logs -f app`.

### Updating

```bash
# 1. Back up first (see docs/OPERATIONS.md for the full runbook)
#    e.g. copy the db out of the volume, then snapshot it from a host checkout.
# 2. Pull and rebuild
git pull
docker compose up -d --build
# 3. Verify
curl http://localhost:3000/api/health
```

The entrypoint auto-syncs the schema on boot. If an upstream schema change would destroy data (column drop/type change), `prisma db push` refuses, the container exits, and the logs tell you what conflicted — resolve intentionally, never by blindly adding `--accept-data-loss`.

## Option B — Bare metal (pnpm / node)

```bash
git clone https://github.com/razikuljoni/Circuit-Retail-ERP.git
cd circuit-retail-erp
pnpm install                          # runs prisma generate
cp .env.example .env                 # DATABASE_URL should be an ABSOLUTE file: path
pnpm run db:push
pnpm run build                        # next build (standalone) + static/public copy
pnpm run start                        # NODE_ENV=production node .next/standalone/server.js
```

For a permanent install, run it as a systemd service. Example unit (`/etc/systemd/system/circuit.service`):

```ini
[Unit]
Description=Circuit Retail ERP
After=network.target

[Service]
Type=simple
User=circuit
WorkingDirectory=/opt/circuit-retail-erp
EnvironmentFile=/etc/circuit/.env
ExecStart=/usr/bin/pnpm run start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now circuit
journalctl -u circuit -f
```

PM2 works too (`pm2 start "pnpm run start" --name circuit`), but systemd is sufficient for a single-shop deployment.

## Reverse proxy

Keep the Node process off the public internet; terminate TLS at a proxy.

### Caddy (automatic HTTPS)

```caddyfile
pos.example.com {
    reverse_proxy localhost:3000
}
```

### nginx

```nginx
server {
    listen 443 ssl;
    server_name pos.example.com;
    # ssl_certificate     /etc/letsencrypt/live/pos.example.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/pos.example.com/privkey.pem;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_set_header   X-Real-IP         $remote_addr;
        client_max_body_size 5m;   # JSON uploads carry base64 data-URI images
    }
}
```

## Option C — Vercel

Circuit Retail ERP is built on Next.js App Router and can be deployed directly to [Vercel](https://vercel.com).

### 1. Environment Variables in Vercel
In your Vercel Project Settings → Environment Variables, add:
- `DATABASE_URL`: `file:/tmp/custom.db` (for ephemeral serverless preview/testing) or a remote libSQL/Turso URL for persistent serverless storage.
- `SEED_TOKEN`: A secure random secret string to protect `POST /api/seed`.
- `NEXT_PUBLIC_APP_URL`: `https://your-project.vercel.app`

### 2. Deploying via Vercel CLI
```bash
# Preview deployment
vercel

# Production deployment
vercel --prod
```

---

## Option D — Cloudflare Pages

Deploying on Cloudflare Pages utilizes OpenNext / `@cloudflare/next-on-pages`:

1. Connect your GitHub repository `https://github.com/razikuljoni/Circuit-Retail-ERP.git` to Cloudflare Pages.
2. Build command: `npx @cloudflare/next-on-pages@1` (or `pnpm build`).
3. Set environment variable `DATABASE_URL` in Cloudflare Pages settings.

---

## First-run checklist

1. **Schema synced** — container boots clean or `pnpm run db:push` exited 0; `/api/health` returns `200 {"status":"ok"}`.
2. **Store profile** — open `#/settings` and set store name, address, phone, currency (default ৳ BDT) and receipt footer.
3. **Demo data** — seed **in development only** (`pnpm run db:seed` or the Settings → data tools). In production, reseeding requires `SEED_TOKEN` (see [OPERATIONS.md](OPERATIONS.md)); consider leaving it unset so it stays disabled.
4. **Backups scheduled** — hourly `pnpm run backup` via cron and an offsite copy (see below).
5. **Access control** — app reachable only on the LAN or behind your authenticating proxy; TLS active.

## Backups & restore (summary)

- **Backup (safe while running):** `pnpm run backup` → `backups/circuit-erp-<timestamp>.db` via SQLite `VACUUM INTO`, verified with `PRAGMA integrity_check`.
- **Restore:** **stop the app**, then `pnpm run restore backups/<file>.db` (verifies, archives the current db as `*.bak-<timestamp>`, clears WAL sidecars), then start and verify.
- Full procedures, cron examples, and Docker-specific notes: [OPERATIONS.md](OPERATIONS.md).

## Monitoring

`GET /api/health` is the single probe to watch:

- `200` with `"status":"ok"` — app + database healthy.
- `503` with `"status":"degraded"` — the `SELECT 1` database check failed; inspect logs.

The response also includes `version`, `uptimeSeconds`, and per-check `latencyMs`. The compose healthcheck polls it every 30s (`start_period 25s`).

For an external uptime monitor, point it at `https://pos.example.com/api/health` and alert on any non-200, or on `"status":"degraded"`.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Container restarts immediately after an update | Schema drift that would destroy data; entrypoint refuses it (by design) | `docker compose logs app`, resolve the listed conflict intentionally, then rebuild. Do not add `--accept-data-loss` blindly. |
| `EADDRINUSE :3000` | Port already taken (old process, another service) | Stop the other process or change `PORT` / `APP_PORT`. |
| Prisma 500s mentioning unknown fields after a schema change | Stale in-memory Prisma client (dev server kept running across `db:push`/`generate`) | Restart the dev server (`pnpm run dev`). |
| `SQLITE_BUSY` / database is locked | Two app instances writing one db file | Run exactly one app process per SQLite file. |
| `403` on `POST /api/seed` | Production guard: `SEED_TOKEN` unset, or header missing | Set `SEED_TOKEN` and send it as `x-seed-token` (see OPERATIONS.md), or reseed in dev instead. |
| `/api/health` returns `503 degraded` | Database unreachable (bad `DATABASE_URL`, volume not mounted, file corruption) | Check logs and the `checks.database.error` field in the response; verify the volume/path, restore from backup if corrupted. |
| Time-dependent numbers look "off" | Expecting server-local time | Not a bug: the server's timezone is irrelevant — all day windows are computed in Dhaka time (UTC+6) in application code. |
