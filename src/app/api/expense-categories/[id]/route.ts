// PUT /api/expense-categories/[id] — update
// DELETE /api/expense-categories/[id] — delete (blocked if expenses exist)
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { bad, zodMsg, isUniqueError } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

const putSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120).optional(),
  color: z.string().trim().max(32).optional().nullable(),
})

export async function PUT(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  try {
    const data = putSchema.parse(await req.json())
    const existing = await db.expenseCategory.findUnique({ where: { id } })
    if (!existing) return bad('Expense category not found', 404)

    const updated = await db.expenseCategory.update({ where: { id }, data })
    return NextResponse.json(updated)
  } catch (e) {
    if (e instanceof z.ZodError) return bad(zodMsg(e))
    if (isUniqueError(e)) return bad('Expense category name already exists')
    console.error('PUT /api/expense-categories/[id] error:', e)
    return bad('Failed to update expense category', 500)
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  try {
    const existing = await db.expenseCategory.findUnique({
      where: { id },
      include: { _count: { select: { expenses: true } } },
    })
    if (!existing) return bad('Expense category not found', 404)
    if (existing._count.expenses > 0) return bad('Category has expenses')

    await db.expenseCategory.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('DELETE /api/expense-categories/[id] error:', e)
    return bad('Failed to delete expense category', 500)
  }
}
