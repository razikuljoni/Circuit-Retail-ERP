// GET  /api/expenses — filtered list with summary over the whole filtered set
// POST /api/expenses — create
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { bad, zodMsg, round2, isDayKey, numParam } from '@/lib/api-utils'
import { dayKeyToUTCStart, dayKeyToUTCEnd } from '@/lib/format'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const from = sp.get('from')
    const to = sp.get('to')
    const categoryId = sp.get('categoryId')?.trim() ?? ''
    const method = sp.get('method')?.trim() ?? ''
    const search = sp.get('search')?.trim() ?? ''
    const limit = Math.min(500, Math.max(1, Math.floor(numParam(sp.get('limit'), 50))))
    const offset = Math.max(0, Math.floor(numParam(sp.get('offset'), 0)))

    const where: Prisma.ExpenseWhereInput = {}
    if (isDayKey(from) || isDayKey(to)) {
      const spentAt: Prisma.DateTimeFilter = {}
      if (isDayKey(from)) spentAt.gte = dayKeyToUTCStart(from)
      if (isDayKey(to)) spentAt.lt = dayKeyToUTCEnd(to)
      where.spentAt = spentAt
    }
    if (categoryId) where.categoryId = categoryId
    if (method && ['CASH', 'CARD', 'MOBILE', 'BANK'].includes(method)) where.paymentMethod = method
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { reference: { contains: search } },
        { note: { contains: search } },
      ]
    }

    const [expenses, total, agg, byMethodGroup, byCategoryGroup, cats] = await Promise.all([
      db.expense.findMany({
        where,
        orderBy: { spentAt: 'desc' },
        take: limit,
        skip: offset,
        include: { category: true },
      }),
      db.expense.count({ where }),
      db.expense.aggregate({ where, _sum: { amount: true } }),
      db.expense.groupBy({ by: ['paymentMethod'], where, _sum: { amount: true } }),
      db.expense.groupBy({ by: ['categoryId'], where, _sum: { amount: true } }),
      db.expenseCategory.findMany({ orderBy: { name: 'asc' } }),
    ])

    const byMethod: Record<string, number> = { CASH: 0, CARD: 0, MOBILE: 0, BANK: 0 }
    for (const g of byMethodGroup) byMethod[g.paymentMethod] = round2(g._sum.amount ?? 0)

    const catName = new Map(cats.map((c) => [c.id, c.name]))
    const byCategory = byCategoryGroup
      .map((g) => ({
        categoryId: g.categoryId,
        name: g.categoryId ? catName.get(g.categoryId) ?? 'Uncategorized' : 'Uncategorized',
        amount: round2(g._sum.amount ?? 0),
      }))
      .sort((a, b) => b.amount - a.amount)

    return NextResponse.json({
      expenses,
      total,
      summary: {
        total: round2(agg._sum.amount ?? 0),
        byMethod,
        byCategory,
      },
    })
  } catch (e) {
    console.error('GET /api/expenses error:', e)
    return bad('Failed to load expenses', 500)
  }
}

const postSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  amount: z.number().positive('Amount must be > 0'),
  categoryId: z.string().trim().optional().nullable(),
  paymentMethod: z.enum(['CASH', 'CARD', 'MOBILE', 'BANK']).optional().default('CASH'),
  spentAt: z.string().optional(),
  reference: z.string().trim().max(80).optional().nullable(),
  note: z.string().max(1000).optional().nullable(),
})

export async function POST(req: NextRequest) {
  try {
    const body = postSchema.parse(await req.json())

    let spentAt = new Date()
    if (body.spentAt) {
      const d = new Date(body.spentAt)
      if (Number.isNaN(d.getTime())) return bad('spentAt is not a valid datetime')
      spentAt = d
    }

    const expense = await db.expense.create({
      data: {
        title: body.title,
        categoryId: body.categoryId || null,
        amount: body.amount,
        paymentMethod: body.paymentMethod,
        spentAt,
        reference: body.reference ?? null,
        note: body.note ?? null,
      },
      include: { category: true },
    })
    return NextResponse.json(expense, { status: 201 })
  } catch (e) {
    if (e instanceof z.ZodError) return bad(zodMsg(e))
    console.error('POST /api/expenses error:', e)
    return bad('Failed to create expense', 500)
  }
}
