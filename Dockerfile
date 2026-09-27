# ═══════════════════════════════════════════════════════════════════════════
#  Circuit Retail ERP — production image (multi-stage)
#
#  deps     → install node_modules with Bun (reproducible via bun.lock)
#  builder  → prisma generate + next build (standalone bundle, self-assembled
#             by package.json's "build" script: it copies .next/static and
#             public/ INTO .next/standalone, so that folder is self-contained)
#  runner   → Debian + Node 22 only; the entrypoint syncs the SQLite schema
#             on every boot, then starts the standalone server
#
#  Build:  docker build -t circuit-retail-erp .
#  Run:    docker compose up -d --build      (see docker-compose.yml)
# ═══════════════════════════════════════════════════════════════════════════

# ── Stage 1/3: deps ─────────────────────────────────────────────────────────
# Only the manifests are copied first, so this layer stays cached until
# package.json / bun.lock actually change.
FROM oven/bun:1-slim AS deps
WORKDIR /app
COPY package.json bun.lock* ./
# The package.json postinstall hook runs `prisma generate`, which needs the
# schema file — copied here (and only here) to keep the cache surface small.
COPY prisma ./prisma
# --frozen-lockfile: exact bun.lock resolution, zero lockfile drift.
RUN bun install --frozen-lockfile

# ── Stage 2/3: builder ──────────────────────────────────────────────────────
FROM oven/bun:1-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
# Full source (the .dockerignore keeps junk dirs, .env*, logs, the live db
# and node_modules out of the build context).
COPY . .
# Placeholder DATABASE_URL: nothing connects to a database at build time
# (all API routes are dynamic), but prisma generate refuses to run without
# the env var defined.
ENV DATABASE_URL=file:/tmp/build-placeholder.db
# Regenerate the client against the final schema, then build.
# NOTE: the "build" script self-assembles the standalone bundle — after
# `next build` it copies .next/static into .next/standalone/.next/ and
# public/ into .next/standalone/ — so .next/standalone is fully
# self-contained and the runner only needs the copies listed below.
RUN bunx prisma generate && bun run build

# ── Stage 3/3: runner ───────────────────────────────────────────────────────
FROM node:22-slim AS runner

LABEL org.opencontainers.image.title="Circuit Retail ERP" \
      org.opencontainers.image.description="Retail operations suite — POS invoicing, inventory & stock ledger, expenses, live daily sales dashboard (Next.js 16 + Prisma 6 + SQLite)" \
      org.opencontainers.image.licenses="MIT"
# org.opencontainers.image.source: set to the canonical repository URL once
# the project has one (package.json carries no repository field today).

WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_URL=file:/app/db/custom.db

# Self-contained standalone bundle: server.js, .next (with static assets and
# public/ already inside — see the builder note) and the pruned node_modules.
COPY --from=builder /app/.next/standalone ./

# Full node_modules ON TOP of the pruned standalone node_modules — a
# deliberate trade of image size for operational reliability: it ships the
# prisma CLI (node_modules/.bin/prisma) + engines so the entrypoint can run
# `prisma db push` on every boot to keep the SQLite schema in sync (and the
# generated @prisma/client runtime is always present). To slim the image
# later, drop this COPY and pre-bake schema changes into the build pipeline
# instead of syncing on boot.
COPY --from=builder /app/node_modules ./node_modules

# Support files: manifest for the CLI, Next config (loaded by `next start`),
# the schema (source of truth for the entrypoint schema sync) and the
# operator scripts (backup/restore/seed — Bun TS scripts meant to be run
# from the HOST against the mounted db volume; copied for completeness).
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts

# public/ is NOT copied again on purpose: the "build" script already copied
# it into .next/standalone, so the standalone COPY above placed it at
# /app/public — exactly where the server serves it from (it serves ./public
# relative to server.js). A second COPY would duplicate the same bytes into
# an extra image layer for zero benefit.

# Boot logic: non-destructive schema sync + server start.
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh \
 && mkdir -p /app/db /app/backups

# Metadata only; the real listen port is ${PORT} (default 3000, see env).
EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
