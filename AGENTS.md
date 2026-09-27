# Agent Instructions: Circuit Retail ERP

Compact guidance for AI agents working in this repository.

## Developer Commands & Verification
- **Package Manager & Commands**: Use **pnpm** (or **npm** in production). Commands: `pnpm install`, `pnpm dev`, `pnpm build`.
- **Required Env**: `DATABASE_URL` must be set for Prisma commands and `pnpm build` (e.g. `DATABASE_URL="file:./db/custom.db"` or `DATABASE_URL="file:/tmp/ci.db"`).
- **Schema & Dev Server**: Sync SQLite schema with `pnpm db:push`. **Restart dev server after schema changes or `prisma generate`** — stale in-memory Prisma client instances trigger HTTP 500 errors.
- **Quality Gates**:
  1. `pnpm lint` (0 errors required)
  2. `pnpm typecheck` (`tsc --noEmit`; excludes `tests/`, `examples/`, `skills/`, `download/`, `tool-results/`, `agent-ctx/`)
  3. `pnpm build` (Next.js standalone build gate)

## Architecture & Code Structure
- **Single-Route SPA**: The entire application runs on route `/` with 10 hash-synced views (`#/dashboard`, `#/pos`, `#/sales`, `#/products`, `#/inventory`, `#/expenses`, `#/customers`, `#/suppliers`, `#/reports`, `#/settings`) managed by Zustand (`src/store/ui.ts`) and `src/app/page.tsx`. Do not create separate page routes under `src/app/` for feature views.
- **API & DTO Contract**: ~42 route handlers reside in `src/app/api/`. `src/lib/types.ts` is the single source of truth for API request/response types.
- **Data Persistence**: Single-tenant SQLite database stored at `db/custom.db`. Direct backups use `pnpm backup` (`VACUUM INTO`).

## Business Logic & Conventions
- **Timezone**: Day boundaries and analytics require **Asia/Dhaka (UTC+6)** handling. Always use helpers in `src/lib/format.ts` (`startOfTodayUTC`, `dayKeyToUTCStart`, etc.) rather than system local time.
- **Currency & Money**: Currency is **BDT (৳)**. Use `round2()` from `src/lib/format.ts` for all monetary calculations.
- **Authentication**: Single-tenant unauthenticated system. `POST /api/seed` requires the `x-seed-token` header when `SEED_TOKEN` is configured.

## Task Conventions
- **`worklog.md`**: Append task completion entries to `worklog.md` (Task ID, Agent, Work Log, Verification, Stage Summary). Never overwrite previous entries.
