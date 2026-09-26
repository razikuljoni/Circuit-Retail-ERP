// GET /api/shifts/current — the open shift (or null) with live cash totals
// Window: [shift.openedAt, now)
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { bad } from '@/lib/api-utils'
import { shiftTotals, zeroShiftTotals } from '../totals'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const shift = await db.shift.findFirst({
      where: { closedAt: null },
      orderBy: { openedAt: 'desc' },
    })

    if (!shift) {
      return NextResponse.json({ shift: null, totals: zeroShiftTotals(), expensesPaid: 0 })
    }

    const { totals, expensesPaid } = await shiftTotals(shift.openedAt, new Date(), shift.openingFloat)
    return NextResponse.json({ shift, totals, expensesPaid })
  } catch (e) {
    console.error('GET /api/shifts/current error:', e)
    return bad('Failed to load current shift', 500)
  }
}
