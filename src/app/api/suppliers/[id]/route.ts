// PUT /api/suppliers/[id] — update
// DELETE /api/suppliers/[id] — delete (blocked if products exist)
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { bad, zodMsg } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

const putSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(160).optional(),
  phone: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().max(160).optional().nullable(),
  address: z.string().max(300).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
})

export async function PUT(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  try {
    const data = putSchema.parse(await req.json())
    const existing = await db.supplier.findUnique({ where: { id } })
    if (!existing) return bad('Supplier not found', 404)

    const updated = await db.supplier.update({ where: { id }, data })
    return NextResponse.json(updated)
  } catch (e) {
    if (e instanceof z.ZodError) return bad(zodMsg(e))
    console.error('PUT /api/suppliers/[id] error:', e)
    return bad('Failed to update supplier', 500)
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  try {
    const existing = await db.supplier.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    })
    if (!existing) return bad('Supplier not found', 404)
    if (existing._count.products > 0) return bad('Supplier has products')

    await db.supplier.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('DELETE /api/suppliers/[id] error:', e)
    return bad('Failed to delete supplier', 500)
  }
}
