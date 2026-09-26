// PUT /api/categories/[id] — update
// DELETE /api/categories/[id] — delete (blocked if products exist)
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { bad, zodMsg, isUniqueError } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

const putSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120).optional(),
  color: z.string().trim().max(32).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
})

export async function PUT(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  try {
    const data = putSchema.parse(await req.json())
    const existing = await db.category.findUnique({ where: { id } })
    if (!existing) return bad('Category not found', 404)

    const updated = await db.category.update({ where: { id }, data })
    return NextResponse.json(updated)
  } catch (e) {
    if (e instanceof z.ZodError) return bad(zodMsg(e))
    if (isUniqueError(e)) return bad('Category name already exists')
    console.error('PUT /api/categories/[id] error:', e)
    return bad('Failed to update category', 500)
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  try {
    const existing = await db.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    })
    if (!existing) return bad('Category not found', 404)
    if (existing._count.products > 0) return bad('Category has products')

    await db.category.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('DELETE /api/categories/[id] error:', e)
    return bad('Failed to delete category', 500)
  }
}
