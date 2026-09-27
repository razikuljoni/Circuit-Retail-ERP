// GET /api/health — liveness & readiness probe for uptime monitors,
// orchestrator healthchecks and the docker-compose healthcheck.
// Returns 200 when the app + database are healthy, 503 when degraded.
import { NextResponse } from "next/server";
import { db, ensureDbInitialized } from "@/lib/db";
import { APP_NAME, APP_VERSION } from "@/lib/app-info";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  let database: "up" | "down" = "down";
  let databaseError: string | undefined;

  try {
    await ensureDbInitialized();
    await db.$queryRaw`SELECT 1`;
    database = "up";
  } catch (e) {
    databaseError = e instanceof Error ? e.message : "database unreachable";
  }

  const body = {
    status: database === "up" ? ("ok" as const) : ("degraded" as const),
    name: APP_NAME,
    version: APP_VERSION,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    checks: {
      database: {
        status: database,
        latencyMs: Date.now() - startedAt,
        ...(databaseError ? { error: databaseError } : {}),
      },
    },
  };

  return NextResponse.json(body, { status: database === "up" ? 200 : 503 });
}
