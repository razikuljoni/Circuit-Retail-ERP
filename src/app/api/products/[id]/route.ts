// GET /api/products/[id] — product + last 30 stock movements
// PUT /api/products/[id] — update (stock NOT editable here; use /api/stock/adjust)
// DELETE /api/products/[id] — soft delete (isActive=false)
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { bad, zodMsg, isUniqueError } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  try {
    const product = await db.product.findUnique({
      where: { id },
      include: {
        category: true,
        supplier: true,
        movements: {
          orderBy: { createdAt: 'desc' },
          take: 30,
        },
      },
    })
    if (!product) return bad('Product not found', 404)
    return NextResponse.json(product)
  } catch (e) {
    console.error('GET /api/products/[id] error:', e)
    return bad('Failed to load product', 500)
  }
}

const putSchema = z.object({
  sku: z.string().trim().min(1, 'SKU is required').max(60).optional(),
  barcode: z.string().trim().max(60).optional().nullable(),
  name: z.string().trim().min(1, 'Name is required').max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  unit: z.string().trim().max(20).optional(),
  categoryId: z.string().trim().optional().nullable(),
  supplierId: z.string().trim().optional().nullable(),
  costPrice: z.number().min(0, 'Cost price must be >= 0').optional(),
  price: z.number().min(0, 'Price must be >= 0').optional(),
  taxRate: z.number().min(0).max(100).optional(),
  reorderLevel: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
  // stock intentionally NOT accepted — stock changes go through /api/stock/adjust
})

export async function PUT(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  try {
    const body = await req.json()
    const data = putSchema.parse(body)

    const existing = await db.product.findUnique({ where: { id } })
    if (!existing) return bad('Product not found', 404)

    if (data.sku && data.sku !== existing.sku) {
      const skuExists = await db.product.findUnique({ where: { sku: data.sku } })
      if (skuExists) return bad(`SKU "${data.sku}" already exists`)
    }
    if (data.barcode && data.barcode !== existing.barcode) {
      const barcodeExists = await db.product.findUnique({ where: { barcode: data.barcode } })
      if (barcodeExists) return bad(`Barcode "${data.barcode}" already exists`)
    }

    const updated = await db.product.update({
      where: { id },
      data: {
        ...data,
        barcode: data.barcode === undefined ? undefined : data.barcode || null,
        categoryId: data.categoryId === undefined ? undefined : data.categoryId || null,
        supplierId: data.supplierId === undefined ? undefined : data.supplierId || null,
      },
      include: { category: true, supplier: true },
    })
    return NextResponse.json(updated)
  } catch (e) {
    if (e instanceof z.ZodError) return bad(zodMsg(e))
    if (isUniqueError(e)) return bad('SKU or barcode already exists')
    console.error('PUT /api/products/[id] error:', e)
    return bad('Failed to update product', 500)
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  try {
    const existing = await db.product.findUnique({ where: { id } })
    if (!existing) return bad('Product not found', 404)

    await db.product.update({ where: { id }, data: { isActive: false } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('DELETE /api/products/[id] error:', e)
    return bad('Failed to archive product', 500)
  }
}
