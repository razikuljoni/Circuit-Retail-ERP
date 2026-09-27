# ═══════════════════════════════════════════════════════════════════════════
#  Circuit Retail ERP — production image (multi-stage)
#
#  deps     → install node_modules with pnpm (reproducible via pnpm-lock.yaml)
#  builder  → prisma generate + next build (standalone bundle, self-assembled
#             by package.json's "build" script: it copies .next/static and
#             public/ INTO .next/standalone, so that folder is self-contained)
#  runner   → Node 22 only; the entrypoint syncs the SQLite schema
#             on every boot, then starts the standalone server
#
#  Build:  docker build -t circuit-retail-erp .
#  Run:    docker compose up -d --build      (see docker-compose.yml)
# ═══════════════════════════════════════════════════════════════════════════

# ── Stage 1/3: deps ─────────────────────────────────────────────────────────
FROM node:22-slim AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

# ── Stage 2/3: builder ──────────────────────────────────────────────────────
FROM node:22-slim AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV DATABASE_URL=file:/tmp/build-placeholder.db
RUN pnpm exec prisma generate && pnpm run build

# ── Stage 3/3: runner ───────────────────────────────────────────────────────
FROM node:22-slim AS runner

LABEL org.opencontainers.image.title="Circuit Retail ERP" \
      org.opencontainers.image.description="Retail operations suite — POS invoicing, inventory & stock ledger, expenses, live daily sales dashboard (Next.js 16 + Prisma 6 + SQLite)" \
      org.opencontainers.image.licenses="MIT"

WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_URL=file:/app/db/custom.db

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts

COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh \
 && mkdir -p /app/db /app/backups

EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
