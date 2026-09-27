/// <reference types="bun-types" />
/**
 * Circuit Retail ERP — SQLite restore tool.
 *
 * Verifies a backup snapshot, archives the current database file, then
 * copies the snapshot in place.
 *
 * Usage:  bun run restore backups/circuit-erp-YYYYMMDD-HHMMSS.db
 *
 * IMPORTANT: stop the app first (docker compose stop / pm2 stop / Ctrl-C)
 * so no process holds an open file handle to the database being replaced.
 * See docs/OPERATIONS.md for the full runbook.
 */
import { copyFileSync, existsSync, statSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { Database } from "bun:sqlite";

function resolveDbPath(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw || !raw.startsWith("file:")) {
    console.error(
      "✗ DATABASE_URL must be set to a SQLite file: URL (see .env.example)"
    );
    process.exit(1);
  }
  const p = raw.slice("file:".length);
  if (p.startsWith(":memory:")) {
    console.error("✗ Cannot restore over an in-memory database");
    process.exit(1);
  }
  // Prisma resolves RELATIVE file: URLs against the prisma/ schema
  // directory — mirror that convention so both tools agree.
  return p.startsWith("/") ? p : resolve(process.cwd(), "prisma", p);
}

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(
    d.getHours()
  )}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: bun run restore backups/circuit-erp-<timestamp>.db");
    process.exit(1);
  }
  const src = resolve(arg);
  if (!existsSync(src)) {
    console.error(`✗ Backup file not found: ${src}`);
    process.exit(1);
  }

  // 1) Verify the backup BEFORE touching anything.
  const check = new Database(src, { readonly: true });
  const row = check.query("PRAGMA integrity_check").get() as {
    integrity_check: string;
  } | null;
  check.close();
  if (!row || row.integrity_check !== "ok") {
    console.error(
      `✗ Backup FAILED integrity check (${row?.integrity_check ?? "unknown"}) — aborting, nothing was changed.`
    );
    process.exit(1);
  }

  const target = resolveDbPath();
  console.log(`• Backup : ${src} (${(statSync(src).size / 1024).toFixed(1)} KB)`);
  console.log(`• Target : ${target}`);

  // 2) Archive the current database so the restore itself is reversible.
  if (existsSync(target)) {
    const archive = `${target}.bak-${timestamp()}`;
    copyFileSync(target, archive);
    console.log(`• Archived current db → ${archive}`);
  }

  // 3) Copy the snapshot in place and clear stale WAL sidecars so the
  //    restored file is not paired with another database's write-ahead log.
  copyFileSync(src, target);
  for (const side of [`${target}-wal`, `${target}-shm`]) {
    if (existsSync(side)) unlinkSync(side);
  }

  console.log("✓ Restore complete.");
  console.log(
    "→ Start the app now (docker compose up -d, or bun run start / dev)."
  );
}

main();
