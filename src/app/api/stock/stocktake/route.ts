// POST /api/stock/stocktake — bulk physical inventory count (transactional).
// Body: { counts: [{ productId, countedQty }], note? }
// For every product where countedQty ≠ system stock, writes an ADJUST
// StockMovement (reference STOCKTAKE) and sets stock to the counted value.
// Returns a per-item summary + totals so the UI can show what changed.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { bad, zodMsg, round2 } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  counts: z
    .array(
      z.object({
        productId: z.string().trim().min(1, 'productId is required'),
        countedQty: z.number().min(0, 'counted quantity cannot be negative'),
      })
    )
    .min(1, 'Enter at least one counted product')
    .max(500, 'A stocktake can cover at most 500 products at once'),
  note: z.string().trim().max(500).optional().nullable(),
})

export async function POST(req: NextRequest) {
  try {
    const body = bodySchema.parse(await req.json())

    // De-duplicate product ids (last entry wins)
    const byId = new Map<string, number>()
    for (const c of body.counts) byId.set(c.productId, c.countedQty)
    const ids = [...byId.keys()]

    const result = await db.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: { id: { in: ids }, isActive: true },
        select: { id: true, name: true, sku: true, unit: true, stock: true, costPrice: true },
      })
      const found = new Map(products.map((p) => [p.id, p]))

      const changed: {
        productId: string
        name: string
        sku: string
        unit: string
        before: number
        after: number
        delta: number
      }[] = []
      const missing: string[] = []
      let varianceValue = 0 // negative = shrinkage at cost, positive = found stock

      for (const [id, countedQty] of byId) {
        const product = found.get(id)
        if (!product) {
          missing.push(id)
          continue
        }
        const before = product.stock
        if (round2(before) === round2(countedQty)) continue // unchanged — no movement

        const delta = round2(countedQty - before)
        await tx.product.update({ where: { id: product.id }, data: { stock: countedQty } })
        await tx.stockMovement.create({
          data: {
            productId: product.id,
            type: 'ADJUST',
            qty: delta,
            before,
            after: countedQty,
            reference: 'STOCKTAKE',
            note: body.note ?? 'Physical count',
          },
        })
        changed.push({
          productId: product.id,
          name: product.name,
          sku: product.sku,
          unit: product.unit,
          before,
          after: countedQty,
          delta,
        })
        varianceValue += delta * product.costPrice
      }

      return { changed, missing, varianceValue: round2(varianceValue) }
    })

    if (result.missing.length > 0 && result.changed.length === 0) {
      return bad('No matching active products found for the submitted ids', 404)
    }

    return NextResponse.json(
      {
        adjusted: result.changed.length,
        unchanged: byId.size - result.missing.length - result.changed.length,
        missing: result.missing,
        varianceValue: result.varianceValue, // + = found stock at cost, − = shrinkage
        items: result.changed.sort((a, b) => a.name.localeCompare(b.name)),
      },
      { status: 201 }
    )
  } catch (e) {
    if (e instanceof z.ZodError) return bad(zodMsg(e))
    console.error('POST /api/stock/stocktake error:', e)
    return bad('Failed to record stocktake', 500)
  }
}
