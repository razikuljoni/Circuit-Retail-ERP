// GET  /api/purchase-orders — list POs (newest first) with items + supplier
// POST /api/purchase-orders — create a PO (DRAFT or ORDERED); snapshots name/sku/cost
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { bad, zodMsg, round2, nextDocNumber } from '@/lib/api-utils'
import { dhakaDateKey } from '@/lib/format'

export const dynamic = 'force-dynamic'

const itemSchema = z.object({
  productId: z.string().trim().min(1, 'productId is required'),
  qty: z.number().positive('Qty must be > 0'),
  unitCost: z.number().min(0).optional(),
})

const postSchema = z.object({
  supplierId: z.string().trim().optional().nullable(),
  note: z.string().max(1000).optional().nullable(),
  status: z.enum(['DRAFT', 'ORDERED']).optional().default('DRAFT'),
  items: z.array(itemSchema).min(1, 'At least one item is required'),
})

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const status = sp.get('status')
    const supplierId = sp.get('supplierId')
    const limit = Math.min(200, Math.max(1, Number(sp.get('limit')) || 100))

    const where: { status?: string; supplierId?: string } = {}
    if (status && ['DRAFT', 'ORDERED', 'RECEIVED', 'CANCELLED'].includes(status)) where.status = status
    if (supplierId) where.supplierId = supplierId

    const orders = await db.purchaseOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        supplier: { select: { id: true, name: true, phone: true } },
        items: { include: { product: { select: { id: true, name: true, sku: true, unit: true, stock: true } } } },
      },
    })

    // Decorate with computed totals for list rendering
    const decorated = orders.map((po) => ({
      ...po,
      totalCost: round2(po.items.reduce((s, it) => s + it.qty * it.unitCost, 0)),
    }))

    return NextResponse.json({ orders: decorated, total: decorated.length })
  } catch (e) {
    console.error('GET /api/purchase-orders error:', e)
    return bad('Failed to load purchase orders', 500)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = postSchema.parse(await req.json())

    const productIds = [...new Set(body.items.map((i) => i.productId))]
    const products = await db.product.findMany({ where: { id: { in: productIds } } })
    const productMap = new Map(products.map((p) => [p.id, p]))

    for (const it of body.items) {
      const product = productMap.get(it.productId)
      if (!product) return bad('Product not found for one of the PO items')
    }

    if (body.supplierId) {
      const supplier = await db.supplier.findUnique({ where: { id: body.supplierId } })
      if (!supplier) return bad('Supplier not found', 404)
    }

    const po = await db.purchaseOrder.create({
      data: {
        poNo: await nextPoNo(),
        supplierId: body.supplierId || null,
        note: body.note ?? null,
        status: body.status,
        items: {
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
        },
      },
      include: {
        supplier: { select: { id: true, name: true, phone: true } },
        items: { include: { product: { select: { id: true, name: true, sku: true, unit: true, stock: true } } } },
      },
    })

    return NextResponse.json({ ...po, totalCost: round2(po.items.reduce((s, it) => s + it.qty * it.unitCost, 0)) }, { status: 201 })
  } catch (e) {
    if (e instanceof z.ZodError) return bad(zodMsg(e))
    console.error('POST /api/purchase-orders error:', e)
    return bad('Failed to create purchase order', 500)
  }
}

/** PO-YYYYMMDD-#### sequence per Dhaka day (gap-safe: max+1, not count). */
async function nextPoNo(): Promise<string> {
  const prefix = `PO-${dhakaDateKey(new Date()).replace(/-/g, '')}-`
  const rows = await db.purchaseOrder.findMany({
    where: { poNo: { startsWith: prefix } },
    select: { poNo: true },
  })
  return nextDocNumber(prefix, rows.map((r) => r.poNo))
}
