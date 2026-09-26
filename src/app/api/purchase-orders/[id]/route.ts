// GET    /api/purchase-orders/[id] — PO + items + supplier
// PUT    /api/purchase-orders/[id] — update note / status (DRAFT↔ORDERED, CANCELLED); items replaced if provided
// DELETE /api/purchase-orders/[id] — hard delete (DRAFT or CANCELLED only)
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { bad, zodMsg, round2 } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

const putSchema = z.object({
  supplierId: z.string().trim().optional().nullable(),
  note: z.string().max(1000).optional().nullable(),
  status: z.enum(['DRAFT', 'ORDERED', 'CANCELLED']).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().trim().min(1),
        qty: z.number().positive(),
        unitCost: z.number().min(0).optional(),
      })
    )
    .optional(),
})

const PO_INCLUDE = {
  supplier: { select: { id: true, name: true, phone: true } },
  items: { include: { product: { select: { id: true, name: true, sku: true, unit: true, stock: true } } } },
} as const

function decorate(po: { items: { qty: number; unitCost: number }[] }) {
  return { ...po, totalCost: round2(po.items.reduce((s, it) => s + it.qty * it.unitCost, 0)) }
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  try {
    const po = await db.purchaseOrder.findUnique({ where: { id }, include: PO_INCLUDE })
    if (!po) return bad('Purchase order not found', 404)
    return NextResponse.json(decorate(po))
  } catch (e) {
    console.error('GET /api/purchase-orders/[id] error:', e)
    return bad('Failed to load purchase order', 500)
  }
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  try {
    const body = putSchema.parse(await req.json())
    const existing = await db.purchaseOrder.findUnique({
      where: { id },
      include: { items: true },
    })
    if (!existing) return bad('Purchase order not found', 404)
    if (existing.status === 'RECEIVED') return bad('Received purchase orders cannot be edited')

    const data: {
      supplierId?: string | null
      note?: string | null
      status?: string
      items?: {
        deleteMany: Record<string, never>
        create: {
          productId: string
          name: string
          sku: string
          qty: number
          unitCost: number
        }[]
      }
    } = {}
    if (body.supplierId !== undefined) data.supplierId = body.supplierId || null
    if (body.note !== undefined) data.note = body.note
    if (body.status !== undefined) data.status = body.status

    if (body.items) {
      const productIds = [...new Set(body.items.map((i) => i.productId))]
      const products = await db.product.findMany({ where: { id: { in: productIds } } })
      const productMap = new Map(products.map((p) => [p.id, p]))
      for (const it of body.items) {
        if (!productMap.get(it.productId)) return bad('Product not found for one of the PO items')
      }
      data.items = {
        deleteMany: {},
        create: body.items.map((it) => {
          const product = productMap.get(it.productId)!
          return {
            productId: product.id,
            name: product.name,
            sku: product.sku,
            qty: it.qty,
            unitCost: round2(it.unitCost ?? product.costPrice),
          }
        }),
      }
    }

    const updated = await db.$transaction(async (tx) => {
      return tx.purchaseOrder.update({
        where: { id },
        data,
        include: PO_INCLUDE,
      })
    })

    return NextResponse.json(decorate(updated))
  } catch (e) {
    if (e instanceof z.ZodError) return bad(zodMsg(e))
    console.error('PUT /api/purchase-orders/[id] error:', e)
    return bad('Failed to update purchase order', 500)
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  try {
    const existing = await db.purchaseOrder.findUnique({ where: { id } })
    if (!existing) return bad('Purchase order not found', 404)
    if (existing.status === 'RECEIVED' || existing.status === 'ORDERED') {
      return bad(`Cannot delete a ${existing.status.toLowerCase()} purchase order — cancel it first`)
    }
    await db.purchaseOrder.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('DELETE /api/purchase-orders/[id] error:', e)
    return bad('Failed to delete purchase order', 500)
  }
}
