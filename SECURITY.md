# Security Policy

## Supported versions

| Version | Supported |
| --- | --- |
| 1.0.x | ✅ |

## Reporting a vulnerability

Please report vulnerabilities through **GitHub Security Advisories** (repository → Security → Report a vulnerability). This keeps the disclosure private.

- Do **not** open a public GitHub issue for security problems.
- Include: affected version/commit, the view or endpoint involved, and steps or a proof of concept.
- You will get an acknowledgment, and fixes will be released before any public disclosure.

## Scope

In scope: the Next.js application (pages and `/api` route handlers), the Prisma/SQLite data layer, the bundled ops scripts (`scripts/backup.ts`, `scripts/restore.ts`, `scripts/seed.ts`), and the Docker stack (`Dockerfile`, `docker-compose.yml`).

## Security model — read this before deploying

> **This application currently has NO user authentication.** Anyone who can reach the HTTP port can read and write business data (sales, products, customers) and print receipts. It is designed for a **trusted single-shop deployment on a private network or behind an authenticating proxy**. Do not expose it raw to the public internet.

Multi-user auth is on the roadmap (see README → Roadmap).

## Security features implemented

- **Production security headers** (`next.config.ts`): `Content-Security-Policy` and `X-Frame-Options: SAMEORIGIN` in production; always-on `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Permissions-Policy` (camera/microphone/geolocation/payment disabled). `poweredByHeader` is off.
- **Fail-closed seeding**: in production, `POST /api/seed` is disabled (403) unless `SEED_TOKEN` is set and echoed in the `x-seed-token` header (constant-time comparison). In development it is open for convenience.
- **Health endpoint** (`GET /api/health`) reports database status for orchestrator checks, so a broken data layer is visible (503 `degraded`).
- **Backups with integrity checks**: `bun run backup` snapshots via SQLite `VACUUM INTO` and runs `PRAGMA integrity_check`; `bun run restore` verifies before touching anything, archives the current db, and clears WAL sidecars.
- **No secrets in the repo**: `.env` is gitignored; only `.env.example` with placeholders is committed.
- **Defense in depth in the app**: zod validation on mutating endpoints, transactional sale creation, guarded deletes (referential data blocks deletion), and `robots.txt` disallowing `/api/`.

## Hardening recommendations for operators

1. **Set a strong `SEED_TOKEN`** before any production start, or leave it unset to disable reseeding entirely.
2. **Terminate TLS at a reverse proxy** (Caddy or nginx — see `docs/DEPLOYMENT.md`) and keep the app bound to localhost or the Docker network only.
3. **Firewall the host** so port 3000 is reachable only from the LAN/trust zone; never port-forward the raw app to the internet.
4. **If you need auth today**, put an authenticating proxy (e.g. oauth2-proxy, Authelia, Cloudflare Access) in front of the app.
5. **Back up on a schedule** (hourly `bun run backup` via cron) and copy snapshots offsite.
6. **Restrict server access** (SSH keys, non-root service user, minimal open ports) and keep Docker/OS patched.
