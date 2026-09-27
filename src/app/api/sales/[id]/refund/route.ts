// POST /api/sales/[id]/refund — mark REFUNDED, restore stock, write REFUND movements
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { bad } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  try {
    const existing = await db.sale.findUnique({ where: { id }, include: { items: true } })
    if (!existing) return bad('Sale not found', 404)
    if (existing.status === 'REFUNDED') return bad('Sale has already been refunded')

    const updated = await db.$transaction(async (tx) => {
      for (const item of existing.items) {
        if (!item.productId) continue
        const product = await tx.product.findUnique({ where: { id: item.productId } })
        if (!product) continue
        const after = product.stock + item.qty
        await tx.product.update({ where: { id: product.id }, data: { stock: after } })
        await tx.stockMovement.create({
          data: {
            productId: product.id,
            type: 'REFUND',
            qty: item.qty,
            before: product.stock,
            after,
            reference: existing.invoiceNo,
            note: 'Refund',
          },
        })
      }

      return tx.sale.update({
        where: { id },
        data: { status: 'REFUNDED' },
        include: { items: true, customer: true },
      })
    })

    return NextResponse.json(updated)
  } catch (e) {
    console.error('POST /api/sales/[id]/refund error:', e)
    return bad('Failed to refund sale', 500)
  }
}
