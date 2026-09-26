// POST /api/purchase-orders/[id]/receive — receive stock for a PO (transactional):
// per item: stock += qty + StockMovement('PURCHASE', +qty, ref poNo); status → RECEIVED
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { bad, round2 } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

interface ReceiveLine {
  productId: string
  qty: number
  unitCost?: number
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  try {
    // Optional per-line overrides in body: { lines: [{ productId, qty, unitCost }] }
    let overrides: ReceiveLine[] | null = null
    try {
      const body: unknown = await req.json()
      if (body && typeof body === 'object' && Array.isArray((body as { lines?: unknown }).lines)) {
        overrides = (body as { lines: ReceiveLine[] }).lines
      }
    } catch {
      // no/invalid body → receive exactly what the PO says
    }

    const po = await db.purchaseOrder.findUnique({
      where: { id },
      include: { items: true },
    })
    if (!po) return bad('Purchase order not found', 404)
    if (po.status === 'RECEIVED') return bad('Purchase order already received')
    if (po.status === 'CANCELLED') return bad('Cancelled purchase orders cannot be received')
    if (po.items.length === 0) return bad('Purchase order has no items')

    const overrideMap = new Map((overrides ?? []).map((l) => [l.productId, l]))

    const updated = await db.$transaction(
      async (tx) => {
        for (const item of po.items) {
          const ovr = overrideMap.get(item.productId)
          const qty = ovr?.qty ?? item.qty
          const unitCost = ovr?.unitCost ?? item.unitCost
          if (qty <= 0) continue

          const product = await tx.product.findUnique({ where: { id: item.productId } })
          if (!product) throw new Error(`Product not found: ${item.name}`)

          const before = product.stock
          const after = before + qty
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: after, costPrice: unitCost > 0 ? unitCost : product.costPrice },
          })
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              type: 'PURCHASE',
              qty,
              before,
              after,
              reference: po.poNo,
              note: 'Purchase order received',
            },
          })
          if (ovr) {
            await tx.purchaseOrderItem.updateMany({
              where: { poId: po.id, productId: item.productId },
              data: { qty, unitCost: round2(unitCost) },
            })
          }
        }

        return tx.purchaseOrder.update({
          where: { id: po.id },
          data: { status: 'RECEIVED', receivedAt: new Date() },
          include: {
            supplier: { select: { id: true, name: true, phone: true } },
            items: { include: { product: { select: { id: true, name: true, sku: true, unit: true, stock: true } } } },
          },
        })
      },
      { timeout: 15000 }
    )

    return NextResponse.json({
      ...updated,
      totalCost: round2(updated.items.reduce((s, it) => s + it.qty * it.unitCost, 0)),
    })
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('Product not found')) return bad(e.message, 404)
    console.error('POST /api/purchase-orders/[id]/receive error:', e)
    return bad('Failed to receive purchase order', 500)
  }
}
