// POST /api/purchase-orders/bulk-draft — one-click restock drafts.
// Body: { productIds: string[] } — low-stock product ids.
// Groups products by supplier (products without a supplier are skipped) and
// creates one DRAFT purchase order per supplier with suggested quantities:
// qty = max(reorderLevel × 2 − stock, 10). Returns a per-PO summary.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { bad, zodMsg, round2, maxSeqOf } from '@/lib/api-utils'
import { dhakaDateKey } from '@/lib/format'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  productIds: z.array(z.string().trim().min(1)).min(1, 'Select at least one product').max(100),
  note: z.string().max(1000).optional().nullable(),
})

export async function POST(req: NextRequest) {
  try {
    const body = bodySchema.parse(await req.json())
    const ids = [...new Set(body.productIds)]

    const products = await db.product.findMany({
      where: { id: { in: ids }, isActive: true },
      select: { id: true, name: true, sku: true, stock: true, reorderLevel: true, costPrice: true, supplierId: true },
    })

    const skipped: { id: string; name: string; reason: string }[] = []
    const bySupplier = new Map<string | null, typeof products>()

    for (const p of products) {
      if (!p.supplierId) {
        skipped.push({ id: p.id, name: p.name, reason: 'no supplier assigned' })
        continue
      }
      if (p.stock > p.reorderLevel) {
        skipped.push({ id: p.id, name: p.name, reason: 'stock recovered since alert' })
        continue
      }
      const list = bySupplier.get(p.supplierId) ?? []
      list.push(p)
      bySupplier.set(p.supplierId, list)
    }

    if (bySupplier.size === 0) {
      return bad(
        skipped.length > 0
          ? `Nothing to order — ${skipped.map((s) => `${s.name} (${s.reason})`).join(', ')}`
          : 'None of the selected products could be ordered'
      )
    }

    const suppliers = await db.supplier.findMany({
      where: { id: { in: [...bySupplier.keys()].filter((s): s is string => !!s) } },
      select: { id: true, name: true },
    })
    const supplierNames = new Map(suppliers.map((s) => [s.id, s.name]))

    const now = new Date()
    const prefix = `PO-${dhakaDateKey(now).replace(/-/g, '')}-`

    const created = await db.$transaction(async (tx) => {
      // Gap-safe sequence: max existing poNo for today (count() collides after deletions)
      const existingNos = await tx.purchaseOrder.findMany({
        where: { poNo: { startsWith: prefix } },
        select: { poNo: true },
      })
      const out: { id: string; poNo: string; supplierName: string; itemCount: number; totalCost: number }[] = []
      let seq = maxSeqOf(prefix, existingNos.map((r) => r.poNo))

      for (const [supplierId, items] of bySupplier) {
        seq += 1
        const poNo = `${prefix}${String(seq).padStart(4, '0')}`
        const totalCost = round2(
          items.reduce((sum, p) => sum + Math.max(p.reorderLevel * 2 - p.stock, 10) * p.costPrice, 0)
        )
        const po = await tx.purchaseOrder.create({
          data: {
            poNo,
            supplierId: supplierId!,
            note: body.note ?? 'Auto-drafted from dashboard low-stock alerts',
            status: 'DRAFT',
            items: {
              create: items.map((p) => ({
                productId: p.id,
                name: p.name,
                sku: p.sku,
                qty: Math.max(Math.round(p.reorderLevel * 2 - p.stock), 10),
                unitCost: round2(p.costPrice),
              })),
            },
          },
          select: { id: true, poNo: true },
        })
        out.push({
          id: po.id,
          poNo,
          supplierName: supplierNames.get(supplierId!) ?? 'Unknown supplier',
          itemCount: items.length,
          totalCost,
        })
      }
      return out
    })

    return NextResponse.json(
      { created, skipped, suppliersCount: created.length },
      { status: 201 }
    )
  } catch (e) {
    if (e instanceof z.ZodError) return bad(zodMsg(e))
    console.error('POST /api/purchase-orders/bulk-draft error:', e)
    return bad('Failed to draft purchase orders', 500)
  }
}
