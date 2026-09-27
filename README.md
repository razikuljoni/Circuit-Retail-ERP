# Circuit Retail ERP

> Production-ready retail operations suite — POS invoicing, inventory & stock ledger, expenses, and a live daily sales dashboard. Built for Dhaka-time (UTC+6) retail.

![CI](https://github.com/<your-username>/circuit-retail-erp/actions/workflows/ci.yml/badge.svg)
![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![bun](https://img.shields.io/badge/bun-%E2%89%A51.2-f472b6)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![Prisma](https://img.shields.io/badge/Prisma-6-2D3748)

## What is this?

Circuit Retail ERP is a single-tenant, keyboard-friendly retail operations suite for small and medium shops. One process, one SQLite file, zero external services: sell fast at the counter, watch today's numbers live, never run out of stock, and track every expense — with printable receipts, labels, and reports. All day windows are computed in Dhaka time (UTC+6) and all money is BDT (৳), rounded to 2 decimal places.

### Features by module

- 🧭 **Dashboard** — live KPIs, 14-day & hourly charts, quick actions, shift-aware live strip while a cashier shift is open
- 🛒 **POS** — cart with per-line + order discounts, held carts, customer attach, F9 checkout, shift-aware checkout guard that auto-resumes, thermal receipt print with 28px per-line product thumbnails, live shift chip (open/close + counted-cash variance)
- 🧾 **Sales** — filterable list, sale detail with 32px thumbnails, refunds with stock restoration, due settlement, X/Z reports, shift history with persisted close snapshots + reprint
- 📦 **Inventory** — immutable stock ledger, purchase orders + receive/GRN print, stocktake, adjustments, valuation print, days-of-cover badges, CSV import/export
- 💸 **Expenses** — categories, reusable templates, month range picker, attachments with client-side compression (≤300KB), CSV export
- 👥 **Customers** — credit limits, due tracking, aging dialog, settle-all, purchase history, CSV export
- 🚚 **Suppliers** — supplier directory, purchase orders, statements, CSV export
- 📊 **Reports** — sales/expense tables over any Dhaka date range, P&L print
- 🔔 **Notifications** — header bell with low stock, out-of-stock, open-shift, today's totals, and refund alerts (60s poll, deep links)
- 🏷️ **Products** — labels (12-up sheets + bulk printing), Code39 barcode rendering, client-side compressed image upload, detail drawer, bulk select operations
- ⚙️ **Settings** — store profile, data tools: JSON backup export, CSV import/export, demo reseed

### Screenshots

| View | Screenshot |
| --- | --- |
| Dashboard / POS / Reports | _screenshots coming soon_ |

## Quickstart (development)

Prerequisites: **bun ≥ 1.2** (preferred) or **node ≥ 20**.

```bash
git clone https://github.com/<your-username>/circuit-retail-erp.git
cd circuit-retail-erp

bun install                 # runs prisma generate automatically (postinstall)

cp .env.example .env        # then set DATABASE_URL (see table below)

bun run db:push             # create/sync the SQLite schema
bun run db:seed             # optional: 42 demo products, 30 days of sales, etc.

bun run dev                 # → http://localhost:3000
```

## Production

Do not run `bun run dev` in production. The recommended path is Docker Compose:

```bash
cp .env.example .env    # set DATABASE_URL=file:/app/db/custom.db and SEED_TOKEN
docker compose up -d --build
```

Full guide (bare metal, systemd, reverse proxy, backups, monitoring): **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.

## Environment variables

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `DATABASE_URL` | ✅ | — | SQLite `file:` URL. Prisma resolves **relative** URLs against `prisma/` — use an absolute path in production (Compose: `file:/app/db/custom.db`). |
| `SEED_TOKEN` | — | empty | Protects `POST /api/seed` in production: requests must send it as the `x-seed-token` header. Unset in production → seeding is disabled (403). Open in development. |
| `NEXT_PUBLIC_APP_URL` | — | `http://localhost:3000` | Public origin used for SEO/OG metadata. |
| `PORT` | — | `3000` | HTTP port for the production server (`next start` / Docker). |

## Scripts

| Script | Purpose |
| --- | --- |
| `bun run dev` | Next.js dev server on port 3000 (output tee'd to `dev.log`) |
| `bun run build` | Production build (standalone output) + copies `static/` and `public/` into the standalone bundle |
| `bun run start` | Runs the standalone production server (`NODE_ENV=production`, logs to `server.log`) |
| `bun run lint` | ESLint over the repo |
| `bun run typecheck` | `tsc --noEmit` (strict TypeScript) |
| `bun run postinstall` | `prisma generate` (runs automatically after install) |
| `bun run db:push` | Push `prisma/schema.prisma` to the SQLite database (`--accept-data-loss`; dev tooling) |
| `bun run db:generate` | Regenerate the Prisma client |
| `bun run db:migrate` | `prisma migrate dev` |
| `bun run db:reset` | `prisma migrate reset` |
| `bun run db:seed` | Seed demo data (`bun scripts/seed.ts`) |
| `bun run backup` | Consistent SQLite snapshot via `VACUUM INTO` → `backups/circuit-erp-<timestamp>.db` (safe while the app runs) |
| `bun run restore` | Verify + restore a backup file (archives the current db; **stop the app first**) |

## API overview

`GET /api` returns a live, machine-readable index of the surface below; `GET /api/health` is the liveness/readiness probe (200 `ok` / 503 `degraded`, checks the database).

| Group | Endpoints | Notes |
| --- | --- | --- |
| Meta | `GET /api` · `GET /api/health` | Service index; probe |
| Data | `GET /api/backup` · `POST /api/seed` | Full JSON export; seeding **protected in production** (`x-seed-token`) |
| Dashboard / Notifications | `GET /api/dashboard` · `GET /api/notifications` | Live today math, alerts feed |
| Products | `GET\|POST /api/products` · `GET\|PUT\|DELETE /api/products/[id]` · `GET /api/products/[id]/detail` · `POST /api/products/import` | Search/sort/low-stock filters; CSV import |
| Categories | `GET\|POST /api/categories` · `PUT\|DELETE /api/categories/[id]` | Deletes guarded when in use |
| Inventory | `GET /api/stock/movements` · `POST /api/stock/adjust` · `POST /api/stock/stocktake` | Immutable ledger writes |
| Purchase orders | `GET\|POST /api/purchase-orders` · `GET\|PUT\|DELETE /api/purchase-orders/[id]` · `POST /api/purchase-orders/[id]/receive` · `POST /api/purchase-orders/bulk-draft` | Receive = GRN + stock-in |
| Sales | `GET\|POST /api/sales` · `GET /api/sales/[id]` · `POST /api/sales/[id]/refund` · `POST /api/sales/[id]/settle` | Transactional checkout, refunds restore stock |
| Shifts | `GET\|POST /api/shifts` · `GET /api/shifts/current` · `POST /api/shifts/[id]/close` | Single open shift; close persists a totals snapshot |
| Expenses | `GET\|POST /api/expenses` · `PUT\|DELETE /api/expenses/[id]` | — |
| Expense categories | `GET\|POST /api/expense-categories` · `PUT\|DELETE /api/expense-categories/[id]` | GET includes month total |
| Expense templates | `GET\|POST /api/expense-templates` · `PUT\|DELETE /api/expense-templates/[id]` · `POST /api/expense-templates/[id]/post` | One-click posting |
| Customers | `GET\|POST /api/customers` · `GET\|PUT\|DELETE /api/customers/[id]` · `GET /api/customers/aging` · `POST /api/customers/[id]/settle-all` | Aging buckets, due settlement |
| Suppliers | `GET\|POST /api/suppliers` · `PUT\|DELETE /api/suppliers/[id]` · `GET /api/suppliers/[id]/statement` | Statement = PO ledger |
| Reports | `GET /api/reports` | `?type=pnl\|products\|daily` over Dhaka day-key ranges |
| Settings | `GET\|PUT /api/settings` | Single-row store profile |

## Project structure

```
├── src/
│   ├── app/                 # App Router: layout, single page shell, error/not-found, manifest
│   │   └── api/             # 42 route handlers (see API overview)
│   ├── components/
│   │   ├── views/           # the 10 feature views + per-view sub-components
│   │   ├── app/             # shell chrome: header, sidebar, footer, bell, command palette
│   │   ├── shared/          # stat cards, page bits, confirm dialog, product avatar
│   │   └── ui/              # shadcn/ui primitives (New York style)
│   ├── hooks/               # use-api (polling fetch), use-mobile, use-count-up, use-toast
│   ├── lib/                 # db client, format/Dhaka-TZ helpers, typed api client, types, seed
│   └── store/               # zustand stores (ui, pos cart)
├── prisma/                  # schema.prisma (SQLite)
├── scripts/                 # seed.ts, backup.ts, restore.ts
├── db/                      # custom.db — the SQLite database file
├── backups/                 # VACUUM INTO snapshots (circuit-erp-<timestamp>.db)
├── docs/                    # DEPLOYMENT.md, ARCHITECTURE.md, OPERATIONS.md
├── .github/                 # CI + Release workflows, dependabot config
├── Dockerfile               # multi-stage build (bun builder → node:22-slim runner)
└── docker-compose.yml       # app service, app-db/app-backups volumes, /api/health healthcheck
```

## Data model

14 Prisma models on SQLite (`db/custom.db`):

| Model | Purpose |
| --- | --- |
| `Category` | Product taxonomy (name, color) |
| `Supplier` | Vendor directory; linked to products and POs |
| `Product` | Catalog item: SKU/barcode, pricing, tax rate, stock, reorder level |
| `StockMovement` | Immutable stock ledger row — signed qty, before/after, reference |
| `Customer` | Customer with optional credit limit and notes |
| `Sale` | Invoice header: totals, payment method, `COMPLETED`/`REFUNDED` status |
| `SaleItem` | Line snapshot at sale time: name, SKU, price, cost, image URL |
| `PurchaseOrder` | Supplier PO header (`DRAFT` → `ORDERED` → `RECEIVED`) |
| `PurchaseOrderItem` | PO line with per-line `receivedQty` tracking |
| `ExpenseCategory` | Expense taxonomy |
| `ExpenseTemplate` | Reusable one-click expense blueprint |
| `Expense` | Expense record with optional receipt attachment |
| `Settings` | Single row: store profile, currency (৳ BDT), tax rate, receipt footer |
| `Shift` | Cashier shift: opening float, counted cash, close-time totals snapshot |

## Documentation

| Document | Contents |
| --- | --- |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Production deployment: Docker Compose, bare metal + systemd, reverse proxies, first-run checklist, monitoring |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System diagram, module map, subsystems, API conventions, extension points |
| [docs/OPERATIONS.md](docs/OPERATIONS.md) | Runbook: backups, restore, reseeding, schema changes, common errors, upgrades |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Dev setup, conventions, quality gates, PR checklist |
| [SECURITY.md](SECURITY.md) | Reporting vulnerabilities, security model, operator hardening |
| [CHANGELOG.md](CHANGELOG.md) | Release history |

## Development notes

- **Quality gates**: `bun run lint` (0 errors) and `bun run typecheck` must pass; `next build` type-checks as well.
- **Views**: the app is a single-route SPA at `/` with 10 hash-synced views — `#/dashboard`, `#/pos`, `#/sales`, `#/products`, `#/inventory`, `#/expenses`, `#/customers`, `#/suppliers`, `#/reports`, `#/settings`. Refresh/back/forward survive because the view is mirrored into the URL hash.
- **Time & money conventions**: every day window is computed in Dhaka time (UTC+6) via helpers in `src/lib/format.ts` (`startOfTodayUTC`, `dayKeyToUTCStart/End`, …); the server's own timezone is irrelevant. All money is BDT (৳) and rounds to 2 decimals through the shared `round2` helper.

## Roadmap

From the development backlog:

- Shift-aware sales filtering (filter the sales list by shift) + shift CSV export from history
- Notification preferences (mute/steer alert categories)
- Server-side stocktake sessions (persist multi-step counts)
- Server-side multipart image upload (replace client-side data-URI pipeline)
- Multi-user authentication (`Shift.openedBy` → real users table)

## Contributing

Bug reports, fixes and features are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for setup, conventions and the PR checklist.

## Security

This app currently has **no user authentication**; it is designed for trusted single-shop deployment on a private network or behind an authenticating proxy. See [SECURITY.md](SECURITY.md) before exposing it anywhere public. To report a vulnerability, follow the private disclosure process in [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) — © 2026 Circuit Retail ERP contributors.
