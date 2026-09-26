// GET  /api/shifts — recent shift history (newest first)
// POST /api/shifts — open a new cashier shift (only one open shift at a time)
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { bad, zodMsg, numParam } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

const postSchema = z.object({
  openingFloat: z.number().min(0, 'openingFloat must be >= 0').optional().default(0),
  openedBy: z.string().trim().max(80, 'openedBy must be at most 80 characters').optional().nullable(),
  note: z.string().max(500, 'note must be at most 500 characters').optional().nullable(),
})

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const limit = Math.min(50, Math.max(1, Math.floor(numParam(sp.get('limit'), 20))))

    const shifts = await db.shift.findMany({
      orderBy: { openedAt: 'desc' },
      take: limit,
    })
    // Contract decision (18-a): totalsJson is returned as the RAW string that
    // sits on Shift.totalsJson (src/lib/types.ts) — the client parses it
    // defensively into ShiftSnapshot (see sales/shift-history.tsx). Legacy
    // shifts closed before snapshots were persisted keep totalsJson = null.
    return NextResponse.json({ shifts })
  } catch (e) {
    console.error('GET /api/shifts error:', e)
    return bad('Failed to load shifts', 500)
  }
}

export async function POST(req: NextRequest) {
  try {
    // Body is fully optional (empty POST = open with defaults) — tolerate empty bodies.
    const body = postSchema.parse(await req.json().catch(() => ({})))

    // Enforce a single active shift globally (closedAt null = still open).
    const open = await db.shift.findFirst({ where: { closedAt: null } })
    if (open) return bad('A shift is already open', 409)

    const shift = await db.shift.create({
      data: {
        openedAt: new Date(),
        openingFloat: body.openingFloat,
        openedBy: body.openedBy || null, // '' → null
        note: body.note || null, // '' → null
      },
    })
    return NextResponse.json(shift, { status: 201 })
  } catch (e) {
    if (e instanceof z.ZodError) return bad(zodMsg(e))
    console.error('POST /api/shifts error:', e)
    return bad('Failed to open shift', 500)
  }
}
