// GET /api/stock/movements — ledger, newest first, optional filters
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { bad, isDayKey, numParam } from '@/lib/api-utils'
import { dayKeyToUTCStart, dayKeyToUTCEnd } from '@/lib/format'

export const dynamic = 'force-dynamic'

const TYPES = ['PURCHASE', 'SALE', 'ADJUST', 'DAMAGE', 'RETURN', 'REFUND']

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const productId = sp.get('productId')?.trim() ?? ''
    const type = sp.get('type')?.trim() ?? ''
    const from = sp.get('from')
    const to = sp.get('to')
    const limit = Math.min(1000, Math.max(1, Math.floor(numParam(sp.get('limit'), 100))))

    const where: Prisma.StockMovementWhereInput = {}
    if (productId) where.productId = productId
    if (type && TYPES.includes(type)) where.type = type
    if (isDayKey(from) || isDayKey(to)) {
      const createdAt: Prisma.DateTimeFilter = {}
      if (isDayKey(from)) createdAt.gte = dayKeyToUTCStart(from)
      if (isDayKey(to)) createdAt.lt = dayKeyToUTCEnd(to)
      where.createdAt = createdAt
    }

    const movements = await db.stockMovement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { product: { select: { id: true, name: true, sku: true, unit: true } } },
    })

    return NextResponse.json(movements)
  } catch (e) {
    console.error('GET /api/stock/movements error:', e)
    return bad('Failed to load stock movements', 500)
  }
}
