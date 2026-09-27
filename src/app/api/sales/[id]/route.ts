// GET  /api/sales/[id] — full sale incl. items + customer (+ computed due)
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { bad, round2 } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** Outstanding credit for a sale (total − paid, when positive). */
function dueOf(s: { total: number; paid: number }): number {
  return Math.max(0, round2(s.total - s.paid))
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  try {
    const sale = await db.sale.findUnique({
      where: { id },
      include: { items: true, customer: true },
    })
    if (!sale) return bad('Sale not found', 404)
    return NextResponse.json({ ...sale, due: dueOf(sale) })
  } catch (e) {
    console.error('GET /api/sales/[id] error:', e)
    return bad('Failed to load sale', 500)
  }
}
