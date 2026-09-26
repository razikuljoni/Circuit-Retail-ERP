// GET  /api/expense-categories — list with expense counts + current-month totals
// POST /api/expense-categories — create
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { bad, zodMsg, round2, isUniqueError } from '@/lib/api-utils'
import { dhakaNow, dayKeyToUTCStart } from '@/lib/format'

export const dynamic = 'force-dynamic'

/** Start (UTC instant) of the current Dhaka calendar month */
function dhakaMonthStart(): Date {
  const key = dhakaNow().toISOString().slice(0, 8) + '01' // YYYY-MM-01 (Dhaka day key)
  return dayKeyToUTCStart(key)
}

export async function GET() {
  try {
    const monthStart = dhakaMonthStart()
    const [categories, counts, monthAgg] = await Promise.all([
      db.expenseCategory.findMany({
        orderBy: { name: 'asc' },
        include: { _count: { select: { expenses: true } } },
      }),
      db.expenseCategory.findMany({
        select: { id: true, _count: { select: { expenses: true } } },
      }),
      db.expense.groupBy({
        by: ['categoryId'],
        _sum: { amount: true },
        where: { spentAt: { gte: monthStart } },
      }),
    ])

    const monthMap = new Map<string, number>()
    for (const g of monthAgg) {
      if (g.categoryId) monthMap.set(g.categoryId, round2(g._sum.amount ?? 0))
    }

    const withMonth = categories.map((c) => ({
      ...c,
      monthTotal: monthMap.get(c.id) ?? 0,
    }))

    return NextResponse.json(withMonth)
  } catch (e) {
    console.error('GET /api/expense-categories error:', e)
    return bad('Failed to load expense categories', 500)
  }
}

const postSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  color: z.string().trim().max(32).optional().nullable(),
})

export async function POST(req: NextRequest) {
  try {
    const data = postSchema.parse(await req.json())
    const category = await db.expenseCategory.create({ data })
    return NextResponse.json({ ...category, monthTotal: 0 }, { status: 201 })
  } catch (e) {
    if (e instanceof z.ZodError) return bad(zodMsg(e))
    if (isUniqueError(e)) return bad('Expense category name already exists')
    console.error('POST /api/expense-categories error:', e)
    return bad('Failed to create expense category', 500)
  }
}
