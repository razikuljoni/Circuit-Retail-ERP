// GET /api/products — filtered list (search, category, supplier, status, lowStock, outOfStock, sort, limit)
// POST /api/products — create product (+ opening stock movement)
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { bad, zodMsg, isUniqueError, numParam } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const search = sp.get('search')?.trim() ?? ''
    const categoryId = sp.get('categoryId')?.trim() ?? ''
    const supplierId = sp.get('supplierId')?.trim() ?? ''
    const status = sp.get('status') ?? 'active'
    const includeInactive = sp.get('includeInactive') === '1'
    const lowStock = sp.get('lowStock') === '1'
    const outOfStock = sp.get('outOfStock') === '1'
    const sort = sp.get('sort') ?? 'name'
    const limit = sp.get('limit') ? Math.max(1, Math.floor(numParam(sp.get('limit'), 100))) : undefined

    const where: Prisma.ProductWhereInput = {}

    // isActive: explicit status wins; 'all' or includeInactive=1 shows everything; default active only
    if (status === 'active') where.isActive = true
    else if (status === 'inactive') where.isActive = false
    else if (status === 'all' || includeInactive) {
      // no isActive filter
    } else where.isActive = true

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { sku: { contains: search } },
        { barcode: { contains: search } },
      ]
    }
    if (categoryId) where.categoryId = categoryId
    if (supplierId) where.supplierId = supplierId
    if (lowStock) where.stock = { lte: 0 } // refined below — Prisma can't compare two columns
    if (outOfStock) where.stock = { lte: 0 }

    let orderBy: Prisma.ProductOrderByWithRelationInput = { name: 'asc' }
    if (sort === 'stock') orderBy = { stock: 'asc' }
    else if (sort === 'price') orderBy = { price: 'desc' }

    let products = await db.product.findMany({
      where,
      orderBy,
      ...(limit ? { take: limit } : {}),
      include: {
        category: true,
        supplier: true,
      },
    })

    // lowStock filter needs stock <= reorderLevel (column comparison) → filter in JS
    if (lowStock) products = products.filter((p) => p.stock <= p.reorderLevel)

    // Sales velocity (last 7 days) → avg daily qty sold + days of stock cover
    const since7d = new Date(Date.now() - 7 * 86400000)
    const velRows = await db.saleItem.groupBy({
      by: ['productId'],
      where: { productId: { not: null }, sale: { status: 'COMPLETED', createdAt: { gte: since7d } } },
      _sum: { qty: true },
    })
    const velMap = new Map<string, number>()
    for (const r of velRows) {
      if (r.productId) velMap.set(r.productId, r._sum.qty ?? 0)
    }
    const withVelocity = products.map((p) => {
      const weekQty = velMap.get(p.id) ?? 0
      const avgDailyQty = Math.round((weekQty / 7) * 100) / 100
      const daysCover = avgDailyQty > 0 ? Math.round((p.stock / avgDailyQty) * 10) / 10 : null
      return { ...p, avgDailyQty, daysCover }
    })

    return NextResponse.json(withVelocity)
  } catch (e) {
    console.error('GET /api/products error:', e)
    return bad('Failed to load products', 500)
  }
}

const postSchema = z.object({
  sku: z.string().trim().min(1, 'SKU is required').max(60),
  barcode: z.string().trim().max(60).optional().nullable(),
  name: z.string().trim().min(1, 'Name is required').max(200),
  description: z.string().max(2000).optional().nullable(),
  unit: z.string().trim().max(20).optional(),
  categoryId: z.string().trim().optional().nullable(),
  supplierId: z.string().trim().optional().nullable(),
  costPrice: z.number().min(0, 'Cost price must be >= 0'),
  price: z.number().min(0, 'Price must be >= 0'),
  taxRate: z.number().min(0).max(100).optional(),
  stock: z.number().optional(),
  reorderLevel: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = postSchema.parse(await req.json())

    // Friendly uniqueness checks
    const skuExists = await db.product.findUnique({ where: { sku: body.sku } })
    if (skuExists) return bad(`SKU "${body.sku}" already exists`)
    if (body.barcode) {
      const barcodeExists = await db.product.findUnique({ where: { barcode: body.barcode } })
      if (barcodeExists) return bad(`Barcode "${body.barcode}" already exists`)
    }

    const stock = body.stock ?? 0

    const product = await db.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          sku: body.sku,
          barcode: body.barcode || null,
          name: body.name,
          description: body.description ?? null,
          unit: body.unit || 'pcs',
          categoryId: body.categoryId || null,
          supplierId: body.supplierId || null,
          costPrice: body.costPrice,
          price: body.price,
          taxRate: body.taxRate ?? 0,
          stock,
          reorderLevel: body.reorderLevel ?? 5,
          isActive: body.isActive ?? true,
        },
      })

      if (stock > 0) {
        await tx.stockMovement.create({
          data: {
            productId: created.id,
            type: 'PURCHASE',
            qty: stock,
            before: 0,
            after: stock,
            reference: 'OPENING',
            note: 'Opening stock',
          },
        })
      }

      return tx.product.findUnique({
        where: { id: created.id },
        include: { category: true, supplier: true },
      })
    })

    return NextResponse.json(product, { status: 201 })
  } catch (e) {
    if (e instanceof z.ZodError) return bad(zodMsg(e))
    if (isUniqueError(e)) return bad('SKU or barcode already exists')
    console.error('POST /api/products error:', e)
    return bad('Failed to create product', 500)
  }
}
