// POST /api/shifts/[id]/close — close a shift with a counted-cash snapshot
// Recomputes totals over [openedAt, closeTime), stores countedCash + variance.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { bad, zodMsg, round2 } from '@/lib/api-utils'
import { shiftTotals } from '../../totals'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

const postSchema = z.object({
  countedCash: z.number().min(0, 'countedCash must be >= 0'),
  note: z.string().max(500, 'note must be at most 500 characters').optional().nullable(),
})

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  try {
    const body = postSchema.parse(await req.json())

    const shift = await db.shift.findUnique({ where: { id } })
    if (!shift) return bad('Shift not found', 404)
    if (shift.closedAt) return bad('Shift is already closed', 400)

    const closedAt = new Date()
    const { totals, expensesPaid } = await shiftTotals(shift.openedAt, closedAt, shift.openingFloat)
    const variance = round2(body.countedCash - totals.expectedDrawer)

    // Append the close note to the open note (kept separate with " — ")
    const note = body.note
      ? shift.note
        ? `${shift.note} — ${body.note}`
        : body.note
      : shift.note

    const updated = await db.shift.update({
      where: { id },
      data: { closedAt, countedCash: round2(body.countedCash), note },
    })

    return NextResponse.json({ shift: updated, totals, expensesPaid, variance })
  } catch (e) {
    if (e instanceof z.ZodError) return bad(zodMsg(e))
    console.error('POST /api/shifts/[id]/close error:', e)
    return bad('Failed to close shift', 500)
  }
}
