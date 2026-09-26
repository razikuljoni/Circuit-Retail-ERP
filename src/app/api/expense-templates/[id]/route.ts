// PUT    /api/expense-templates/[id] — update a template
// DELETE /api/expense-templates/[id] — delete a template
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { bad, zodMsg, round2 } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

const METHODS = ['CASH', 'CARD', 'MOBILE', 'BANK'] as const
const FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY'] as const

const updateSchema = z.object({
  title: z.string().trim().min(1, 'title is required').max(120).optional(),
  categoryId: z.string().trim().nullable().optional(),
  amount: z.number().positive('amount must be greater than 0').optional(),
  paymentMethod: z.enum(METHODS).optional(),
  frequency: z.enum(FREQUENCIES).optional(),
  note: z.string().trim().max(500).nullable().optional(),
  active: z.boolean().optional(),
  lastPostedAt: z.date().nullable().optional(),
})

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = updateSchema.parse(await req.json())

    const existing = await db.expenseTemplate.findUnique({ where: { id } })
    if (!existing) return bad('Template not found', 404)

    if (body.categoryId) {
      const cat = await db.expenseCategory.findUnique({ where: { id: body.categoryId } })
      if (!cat) return bad('Category not found', 404)
    }

    const template = await db.expenseTemplate.update({
      where: { id },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.categoryId !== undefined ? { categoryId: body.categoryId || null } : {}),
        ...(body.amount !== undefined ? { amount: round2(body.amount) } : {}),
        ...(body.paymentMethod !== undefined ? { paymentMethod: body.paymentMethod } : {}),
        ...(body.frequency !== undefined ? { frequency: body.frequency } : {}),
        ...(body.note !== undefined ? { note: body.note } : {}),
        ...(body.active !== undefined ? { active: body.active } : {}),
        ...(body.lastPostedAt !== undefined ? { lastPostedAt: body.lastPostedAt } : {}),
      },
      include: { category: true },
    })
    return NextResponse.json(template)
  } catch (e) {
    if (e instanceof z.ZodError) return bad(zodMsg(e))
    console.error('PUT /api/expense-templates/[id] error:', e)
    return bad('Failed to update expense template', 500)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const existing = await db.expenseTemplate.findUnique({ where: { id } })
    if (!existing) return bad('Template not found', 404)
    await db.expenseTemplate.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('DELETE /api/expense-templates/[id] error:', e)
    return bad('Failed to delete expense template', 500)
  }
}
