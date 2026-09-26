// GET  /api/expense-templates — list templates (newest update first)
// POST /api/expense-templates — create a reusable expense blueprint
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { bad, zodMsg, round2 } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

const METHODS = ['CASH', 'CARD', 'MOBILE', 'BANK'] as const
const FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY'] as const

const templateSchema = z.object({
  title: z.string().trim().min(1, 'title is required').max(120),
  categoryId: z.string().trim().optional().nullable(),
  amount: z.number().positive('amount must be greater than 0'),
  paymentMethod: z.enum(METHODS).default('CASH'),
  frequency: z.enum(FREQUENCIES).default('MONTHLY'),
  note: z.string().trim().max(500).optional().nullable(),
  active: z.boolean().default(true),
})

export async function GET() {
  try {
    const templates = await db.expenseTemplate.findMany({
      orderBy: [{ active: 'desc' }, { updatedAt: 'desc' }],
      include: { category: true },
    })
    return NextResponse.json(templates)
  } catch (e) {
    console.error('GET /api/expense-templates error:', e)
    return bad('Failed to load expense templates', 500)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = templateSchema.parse(await req.json())

    if (body.categoryId) {
      const cat = await db.expenseCategory.findUnique({ where: { id: body.categoryId } })
      if (!cat) return bad('Category not found', 404)
    }

    const template = await db.expenseTemplate.create({
      data: {
        title: body.title,
        categoryId: body.categoryId || null,
        amount: round2(body.amount),
        paymentMethod: body.paymentMethod,
        frequency: body.frequency,
        note: body.note ?? null,
        active: body.active,
      },
      include: { category: true },
    })
    return NextResponse.json(template, { status: 201 })
  } catch (e) {
    if (e instanceof z.ZodError) return bad(zodMsg(e))
    console.error('POST /api/expense-templates error:', e)
    return bad('Failed to create expense template', 500)
  }
}
