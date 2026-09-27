// POST /api/stock/adjust — stock in/out/correction with ledger row (transactional)
// PURCHASE/RETURN: qty is a positive delta in
// DAMAGE: qty is a positive delta out (must have stock)
// ADJUST: qty is the NEW absolute stock count
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { bad, zodMsg, round2 } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

const adjustSchema = z.object({
  productId: z.string().trim().min(1, 'productId is required'),
  type: z.enum(['PURCHASE', 'ADJUST', 'DAMAGE', 'RETURN']),
  qty: z.number().refine((v) => Number.isFinite(v), 'qty must be a number'),
  note: z.string().max(500).optional().nullable(),
  reference: z.string().trim().max(80).optional().nullable(),
})

export async function POST(req: NextRequest) {
  try {
    const body = adjustSchema.parse(await req.json())

    // Type-specific qty validation
    if (body.type === 'ADJUST') {
      if (body.qty < 0) return bad('ADJUST qty (new stock count) cannot be negative')
    } else {
      if (body.qty <= 0) return bad(`${body.type} qty must be > 0`)
    }

    const movement = await db.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: body.productId } })
      if (!product) throw new Error('PRODUCT_NOT_FOUND')

      const before = product.stock
      let after: number
      let signedQty: number

      switch (body.type) {
        case 'PURCHASE':
        case 'RETURN':
          after = before + body.qty
          signedQty = body.qty
          break
        case 'DAMAGE':
          after = before - body.qty
          signedQty = -body.qty
          break
        case 'ADJUST':
          after = body.qty
          signedQty = round2(after - before)
          break
      }

      if (after < 0) {
        throw new Error(`NEGATIVE_STOCK:${product.name}:${before}`)
      }

      await tx.product.update({ where: { id: product.id }, data: { stock: after } })

      return tx.stockMovement.create({
        data: {
          productId: product.id,
          type: body.type,
          qty: signedQty,
          before,
          after,
          reference: body.reference ?? null,
          note: body.note ?? null,
        },
        include: { product: { select: { id: true, name: true, sku: true, unit: true } } },
      })
    })

    return NextResponse.json(movement, { status: 201 })
  } catch (e) {
    if (e instanceof z.ZodError) return bad(zodMsg(e))
    if (e instanceof Error) {
      if (e.message === 'PRODUCT_NOT_FOUND') return bad('Product not found', 404)
      if (e.message.startsWith('NEGATIVE_STOCK:')) {
        const [, name, before] = e.message.split(':')
        return bad(`Insufficient stock for ${name} (available ${before})`)
      }
    }
    console.error('POST /api/stock/adjust error:', e)
    return bad('Failed to adjust stock', 500)
  }
}
