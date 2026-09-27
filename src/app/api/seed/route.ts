// POST /api/seed — reseed demo data (settings danger zone)
// PRODUCTION GUARD: when NODE_ENV=production this endpoint fails closed.
//   · SEED_TOKEN unset → always 403 (seeding disabled)
//   · SEED_TOKEN set   → caller must send it as the `x-seed-token` header
// In development seeding stays open for convenience.
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runSeed } from "@/lib/seed";

export const dynamic = "force-dynamic";

function seedAuthorized(req: Request): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const expected = process.env.SEED_TOKEN;
  if (!expected) return false;
  const provided = req.headers.get("x-seed-token") ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!seedAuthorized(req)) {
    return NextResponse.json(
      {
        error:
          "Seeding is protected in production. Send the SEED_TOKEN value as the 'x-seed-token' header.",
      },
      { status: 403 }
    );
  }
  try {
    const counts = await runSeed();
    return NextResponse.json({ ok: true, counts });
  } catch (e) {
    console.error("Seed failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Seed failed" },
      { status: 500 }
    );
  }
}
