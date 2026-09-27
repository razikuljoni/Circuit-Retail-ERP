// POST /api/purchase-orders/[id]/receive — receive stock for a PO (transactional).
// Body (optional): { lines: [{ productId, qty, unitCost? }] } — qty is THIS delivery's
// quantity. Omitted body ⇒ receive all remaining quantities (classic full receive).
// Per-line receivedQty accumulates; PO status: all lines fully received → RECEIVED,
// some but not all → PARTIAL, none → status unchanged.
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
      // no/invalid body → receive exactly what the PO says (full remaining)
    }

    const po = await db.purchaseOrder.findUnique({
      where: { id },
      include: { items: true },
    })
    if (!po) return bad('Purchase order not found', 404)
    if (po.status === 'CANCELLED') return bad('Cancelled purchase orders cannot be received')
    if (po.status === 'RECEIVED') return bad('Purchase order already fully received')
    if (po.items.length === 0) return bad('Purchase order has no items')

    const overrideMap = new Map((overrides ?? []).map((l) => [l.productId, l]))

    // Validate up-front so we never half-move stock on a bad request
    const planned: { item: (typeof po.items)[number]; qty: number; unitCost: number }[] = []
    for (const item of po.items) {
      const ovr = overrideMap.get(item.productId)
      const remaining = Math.max(0, item.qty - item.receivedQty)
      const qty = Math.min(ovr ? Math.max(0, Math.floor(ovr.qty)) : remaining, remaining)
      if (ovr && ovr.qty < 0) return bad(`Invalid quantity for ${item.name}`)
      if (ovr && qty > remaining) return bad(`Cannot receive more than ordered for ${item.name} (${remaining} remaining)`)
      if (qty > 0) planned.push({ item, qty, unitCost: ovr?.unitCost ?? item.unitCost })
    }
    if (planned.length === 0) {
      return bad('Nothing to receive — every line is already fully received')
    }

    const updated = await db.$transaction(
      async (tx) => {
        for (const { item, qty, unitCost } of planned) {
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
          await tx.purchaseOrderItem.updateMany({
            where: { poId: po.id, productId: item.productId },
            data: {
              receivedQty: { increment: qty },
              ...(unitCost > 0 ? { unitCost: round2(unitCost) } : {}),
            },
          })
        }

        // Recompute status from fresh items
        const fresh = await tx.purchaseOrderItem.findMany({ where: { poId: po.id } })
        const fullyReceived = fresh.every((it) => it.receivedQty >= it.qty)
        const anyReceived = fresh.some((it) => it.receivedQty > 0)
        const nextStatus = fullyReceived ? 'RECEIVED' : anyReceived ? 'PARTIAL' : po.status

        return tx.purchaseOrder.update({
          where: { id: po.id },
          data: {
            status: nextStatus,
            ...(nextStatus === 'RECEIVED' ? { receivedAt: new Date() } : {}),
          },
          include: {
            supplier: { select: { id: true, name: true, phone: true } },
            items: {
              include: { product: { select: { id: true, name: true, sku: true, unit: true, stock: true } } },
            },
          },
        })
      },
      { timeout: 15000 }
    )

    const receivedNow = planned.reduce((s, p) => s + p.qty, 0)
    return NextResponse.json({
      ...updated,
      receivedNow,
      totalCost: round2(updated.items.reduce((s, it) => s + it.qty * it.unitCost, 0)),
    })
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('Product not found')) return bad(e.message, 404)
    console.error('POST /api/purchase-orders/[id]/receive error:', e)
    return bad('Failed to receive purchase order', 500)
  }
}
