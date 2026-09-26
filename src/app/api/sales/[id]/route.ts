// GET /api/sales/[id] — full sale incl. items + customer
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { bad } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  try {
    const sale = await db.sale.findUnique({
      where: { id },
      include: { items: true, customer: true },
    })
    if (!sale) return bad('Sale not found', 404)
    return NextResponse.json(sale)
  } catch (e) {
    console.error('GET /api/sales/[id] error:', e)
    return bad('Failed to load sale', 500)
  }
}
