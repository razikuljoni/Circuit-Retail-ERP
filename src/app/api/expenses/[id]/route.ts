// PUT /api/expenses/[id] — update
// DELETE /api/expenses/[id] — hard delete
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { bad, zodMsg, isValidImageUrl } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

const putSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200).optional(),
  amount: z.number().positive('Amount must be > 0').optional(),
  categoryId: z.string().trim().optional().nullable(),
  paymentMethod: z.enum(['CASH', 'CARD', 'MOBILE', 'BANK']).optional(),
  spentAt: z.string().optional(),
  reference: z.string().trim().max(80).optional().nullable(),
  note: z.string().max(1000).optional().nullable(),
  attachment: z
    .string()
    .trim()
    .max(450_000)
    .refine((u) => u === '' || isValidImageUrl(u), 'Attachment must be an http(s) or data:image URL')
    .optional()
    .nullable(),
})

export async function PUT(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  try {
    const body = putSchema.parse(await req.json())

    const existing = await db.expense.findUnique({ where: { id } })
    if (!existing) return bad('Expense not found', 404)

    let spentAt: Date | undefined
    if (body.spentAt) {
      const d = new Date(body.spentAt)
      if (Number.isNaN(d.getTime())) return bad('spentAt is not a valid datetime')
      spentAt = d
    }

    const updated = await db.expense.update({
      where: { id },
      data: {
        ...body,
        spentAt,
        categoryId: body.categoryId === undefined ? undefined : body.categoryId || null,
        attachment: body.attachment === undefined ? undefined : body.attachment || null, // '' → null
      },
      include: { category: true },
    })
    return NextResponse.json(updated)
  } catch (e) {
    if (e instanceof z.ZodError) return bad(zodMsg(e))
    console.error('PUT /api/expenses/[id] error:', e)
    return bad('Failed to update expense', 500)
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  try {
    const existing = await db.expense.findUnique({ where: { id } })
    if (!existing) return bad('Expense not found', 404)

    await db.expense.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('DELETE /api/expenses/[id] error:', e)
    return bad('Failed to delete expense', 500)
  }
}
