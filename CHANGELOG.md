# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-09-27

First public release. Built across internal development rounds: foundation and API layer, app shell, the ten feature views, then successive feature rounds (shifts, labels/images, shift history, notifications) and a final production-hardening round (Docker, CI/CD, docs).

### Added

- **Core suite** — single-route SPA at `/` with 10 hash-synced views: Dashboard, POS, Sales, Products, Inventory, Expenses, Customers, Suppliers, Reports, Settings. Dhaka-time (UTC+6) day windows throughout; currency BDT (৳) with 2-decimal rounding.
- **Inventory** — immutable stock ledger, purchase orders with receive flow and GRN print, stocktake, adjustments, valuation print, days-of-cover badges, CSV import/export.
- **POS** — cart with line/order discounts, held carts, customer attach, F9 checkout, shift-aware checkout guard that auto-resumes after opening a shift, thermal receipt print with 28px per-line product thumbnails, live shift chip with open/close and counted-cash variance.
- **Sales** — filterable list with whole-filter summary, sale detail with 32px line thumbnails, refunds that restore stock, due settlement, X/Z reports, shift history dialog with persisted close snapshots and reprint.
- **Expenses** — categories, reusable one-click templates, month range filtering, receipt attachments compressed client-side to ≤300KB, CSV export.
- **Customers** — credit limits, due tracking, aging dialog, settle-all, purchase history, CSV export.
- **Suppliers** — directory, purchase orders, statements, CSV export.
- **Reports** — sales/expense tables over any Dhaka date range and P&L print.
- **Dashboard** — live KPIs, hourly/14-day charts, quick actions, low-stock and stock-value panels, shift-aware live strip (30s poll).
- **Notifications** — header bell with low-stock, out-of-stock, open-shift, today's totals and refund alerts; 60s poll; deep links into the relevant views.
- **Products** — 12-up label sheets plus bulk label printing, Code39 barcode rendering, client-side image compression to data URIs, detail drawer, bulk select operations, CSV import/export.
- **Settings** — store profile and data tools: JSON backup export, CSV import/export, demo reseed.
- **Cashier shifts** — open with float, single-open enforcement, live totals (`GET /api/shifts/current`), close with counted cash and variance, persisted `totalsJson` snapshot for history/reprint.
- **API layer** — ~40 route handlers under `/api` with zod validation, transactional sale creation with per-day invoice numbering and stock ledger writes, plus `GET /api` (service index) and `GET /api/health` (200 ok / 503 degraded liveness probe).
- **Ops tooling** — `bun run backup` (verified `VACUUM INTO` snapshot, safe while running), `bun run restore` (integrity check, archives current db, clears WAL sidecars), demo seed script.
- **Deployment** — multi-stage `Dockerfile` (bun builder → node:22-slim runner) with an entrypoint that syncs the Prisma schema on boot, and `docker-compose.yml` with named volumes (`app-db`, `app-backups`) and an `/api/health` healthcheck.
- **CI/CD** — GitHub Actions `CI` workflow (lint → typecheck → db:push → build → standalone artifact), `Release` workflow publishing the Docker image to ghcr.io on `v*` tags, and weekly npm dependabot updates.
- **Documentation** — README, deployment guide, architecture guide, operations runbook, contribution guide, security policy, code of conduct.

### Changed

- Dev server must be restarted after any `prisma generate`/schema push; a stale in-memory Prisma client returns 500s on new fields (documented operational note, not a code defect).

### Security

- Production-only security headers in `next.config.ts`: Content-Security-Policy and `X-Frame-Options: SAMEORIGIN`; always-on `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`.
- `poweredByHeader` disabled; `robots.txt` disallows `/api/`.
- `POST /api/seed` is fail-closed in production: disabled (403) when `SEED_TOKEN` is unset; when set, callers must supply it as the `x-seed-token` header (constant-time comparison).
- Backup snapshots are verified with `PRAGMA integrity_check` before use; restore archives the current database before replacing it.
- Error boundary, global error page, and 404 page; strict TypeScript compilation gates `next build`.

[1.0.0]: https://github.com/<your-username>/circuit-retail-erp/releases/tag/v1.0.0
