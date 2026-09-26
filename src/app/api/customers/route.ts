// GET /api/customers?search= — list with sales count, lifetime spend, last purchase
// POST /api/customers — create
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { bad, zodMsg, round2 } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const search = req.nextUrl.searchParams.get('search')?.trim() ?? ''
    const where = search
      ? {
          OR: [{ name: { contains: search } }, { phone: { contains: search } }],
        }
      : {}

    const [customers, agg] = await Promise.all([
      db.customer.findMany({
        where,
        orderBy: { name: 'asc' },
        include: { _count: { select: { sales: true } } },
      }),
      db.sale.groupBy({
        by: ['customerId'],
        _sum: { total: true },
        _max: { createdAt: true },
        where: { status: 'COMPLETED', customerId: { not: null } },
      }),
    ])

    const spendMap = new Map<string, { totalSpent: number; lastPurchaseAt: string | null }>()
    for (const row of agg) {
      if (!row.customerId) continue
      spendMap.set(row.customerId, {
        totalSpent: round2(row._sum.total ?? 0),
        lastPurchaseAt: row._max.createdAt ? row._max.createdAt.toISOString() : null,
      })
    }

    const withStats = customers.map((c) => ({
      ...c,
      totalSpent: spendMap.get(c.id)?.totalSpent ?? 0,
      lastPurchaseAt: spendMap.get(c.id)?.lastPurchaseAt ?? null,
    }))

    return NextResponse.json(withStats)
  } catch (e) {
    console.error('GET /api/customers error:', e)
    return bad('Failed to load customers', 500)
  }
}

const postSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(160),
  phone: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().max(160).optional().nullable(),
  address: z.string().max(300).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
})

export async function POST(req: NextRequest) {
  try {
    const data = postSchema.parse(await req.json())
    const customer = await db.customer.create({ data })
    return NextResponse.json({ ...customer, totalSpent: 0, lastPurchaseAt: null }, { status: 201 })
  } catch (e) {
    if (e instanceof z.ZodError) return bad(zodMsg(e))
    console.error('POST /api/customers error:', e)
    return bad('Failed to create customer', 500)
  }
}
