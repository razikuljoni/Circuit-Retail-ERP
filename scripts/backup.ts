/// <reference types="bun-types" />
/**
 * Circuit Retail ERP — SQLite backup tool.
 *
 * Creates a consistent snapshot of the live database using SQLite's
 * `VACUUM INTO` (safe to run while the app is serving traffic), then
 * verifies the snapshot with `PRAGMA integrity_check`.
 *
 * Usage:   bun run backup          (or: bun scripts/backup.ts)
 * Output:  backups/circuit-erp-YYYYMMDD-HHMMSS.db
 *
 * Tip — schedule hourly backups with cron:
 *   0 * * * * cd /path/to/circuit-retail-erp && bun scripts/backup.ts >> backup.log 2>&1
 */
import { existsSync, mkdirSync, statSync } from "node:fs";
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
    console.error("✗ Refusing to back up an in-memory database");
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
  const dbPath = resolveDbPath();
  if (!existsSync(dbPath)) {
    console.error(`✗ Database not found: ${dbPath}`);
    process.exit(1);
  }

  const outDir = resolve(process.cwd(), "backups");
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, `circuit-erp-${timestamp()}.db`);

  console.log(`• Source : ${dbPath}`);

  // 1) Snapshot. VACUUM INTO only reads the source and writes a fresh,
  //    compacted copy — safe against a live database (busy_timeout guards
  //    against momentary write-lock contention).
  const src = new Database(dbPath);
  try {
    src.exec("PRAGMA busy_timeout = 5000");
    src.exec(`VACUUM INTO '${outPath.replace(/'/g, "''")}'`);
  } finally {
    src.close();
  }

  // 2) Verify the snapshot is a valid, intact SQLite database.
  const check = new Database(outPath, { readonly: true });
  const row = check.query("PRAGMA integrity_check").get() as {
    integrity_check: string;
  } | null;
  check.close();

  if (!row || row.integrity_check !== "ok") {
    console.error(
      `✗ Backup FAILED integrity check: ${row?.integrity_check ?? "unknown"}`
    );
    process.exit(1);
  }

  const size = statSync(outPath).size;
  console.log(`✓ Backup : ${outPath}`);
  console.log(`  Size   : ${(size / 1024).toFixed(1)} KB`);
  console.log("  Verify : integrity_check = ok");
  console.log(
    "\nRestore with: bun run restore backups/" +
      outPath.split("/").pop() +
      "   (stop the app first — see docs/OPERATIONS.md)"
  );
}

main();
