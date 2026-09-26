// GET  /api/sales — filtered sales list with summary (whole filtered set)
// POST /api/sales — THE CORE POS ENDPOINT (transactional: sale + items + stock movements)
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { bad, zodMsg, round2, isDayKey, numParam } from '@/lib/api-utils'
import { dayKeyToUTCStart, dayKeyToUTCEnd, dhakaDateKey } from '@/lib/format'

export const dynamic = 'force-dynamic'

const saleItemSchema = z.object({
  productId: z.string().trim().min(1, 'productId is required'),
  qty: z.number().positive('Qty must be > 0'),
  unitPrice: z.number().min(0, 'unitPrice must be >= 0'),
  discount: z.number().min(0, 'discount must be >= 0').optional().default(0),
})

const postSchema = z.object({
  items: z.array(saleItemSchema).min(1, 'At least one item is required'),
  customerId: z.string().trim().optional().nullable(),
  paymentMethod: z.enum(['CASH', 'CARD', 'MOBILE']),
  orderDiscount: z.number().min(0).optional().default(0),
  paid: z.number().min(0).optional(),
  note: z.string().max(1000).optional().nullable(),
})

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const from = sp.get('from')
    const to = sp.get('to')
    const method = sp.get('method')
    const status = sp.get('status')
    const search = sp.get('search')?.trim() ?? ''
    const limit = Math.min(500, Math.max(1, Math.floor(numParam(sp.get('limit'), 50))))
    const offset = Math.max(0, Math.floor(numParam(sp.get('offset'), 0)))

    const where: Prisma.SaleWhereInput = {}
    if (isDayKey(from) || isDayKey(to)) {
      const createdAt: Prisma.DateTimeFilter = {}
      if (isDayKey(from)) createdAt.gte = dayKeyToUTCStart(from)
      if (isDayKey(to)) createdAt.lt = dayKeyToUTCEnd(to)
      where.createdAt = createdAt
    }
    if (method && ['CASH', 'CARD', 'MOBILE'].includes(method)) where.paymentMethod = method
    if (status && ['COMPLETED', 'REFUNDED'].includes(status)) where.status = status
    if (search) {
      where.OR = [
        { invoiceNo: { contains: search } },
        { customer: { is: { name: { contains: search } } } },
      ]
    }

    const completedWhere: Prisma.SaleWhereInput = { ...where, status: 'COMPLETED' }
    const refundedWhere: Prisma.SaleWhereInput = { ...where, status: 'REFUNDED' }

    const [sales, totalCount, completedAgg, refundedAgg] = await Promise.all([
      db.sale.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: { items: true, customer: true },
      }),
      db.sale.count({ where }),
      db.sale.aggregate({
        where: completedWhere,
        _count: true,
        _sum: { total: true, discount: true, tax: true, profit: true },
      }),
      db.sale.aggregate({
        where: refundedWhere,
        _count: true,
        _sum: { total: true },
      }),
    ])

    return NextResponse.json({
      sales,
      total: totalCount,
      summary: {
        count: completedAgg._count + refundedAgg._count,
        gross: round2(completedAgg._sum.total ?? 0),
        discounts: round2(completedAgg._sum.discount ?? 0),
        refunds: round2(refundedAgg._sum.total ?? 0),
        tax: round2(completedAgg._sum.tax ?? 0),
        profit: round2(completedAgg._sum.profit ?? 0),
      },
    })
  } catch (e) {
    console.error('GET /api/sales error:', e)
    return bad('Failed to load sales', 500)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = postSchema.parse(await req.json())

    // Merge duplicate product lines so stock validation is cumulative
    const merged = new Map<string, { qty: number; lines: typeof body.items }>()
    for (const item of body.items) {
      const entry = merged.get(item.productId) ?? { qty: 0, lines: [] }
      entry.qty += item.qty
      entry.lines.push(item)
      merged.set(item.productId, entry)
    }

    const productIds = [...merged.keys()]
    const products = await db.product.findMany({ where: { id: { in: productIds } } })
    const productMap = new Map(products.map((p) => [p.id, p]))

    for (const pid of productIds) {
      const product = productMap.get(pid)
      if (!product) return bad('Product not found for one of the cart items')
      if (!product.isActive) return bad(`Product "${product.name}" is inactive`)
      const needed = merged.get(pid)!.qty
      if (product.stock < needed) {
        return bad(`Insufficient stock for ${product.name} (available ${product.stock})`)
      }
    }

    const sale = await db.$transaction(async (tx) => {
      // ── Compute totals ──
      let subtotal = 0
      let lineDiscountSum = 0
      let taxSum = 0
      let costTotal = 0
      const itemRows: {
        productId: string
        name: string
        sku: string
        qty: number
        unitPrice: number
        discount: number
        taxRate: number
        tax: number
        total: number
        costPrice: number
      }[] = []

      for (const item of body.items) {
        const product = productMap.get(item.productId)!
        const lineTotal = item.unitPrice * item.qty - item.discount
        const lineTax = (lineTotal * (product.taxRate ?? 0)) / 100
        subtotal += item.unitPrice * item.qty
        lineDiscountSum += item.discount
        taxSum += lineTax
        costTotal += product.costPrice * item.qty
        itemRows.push({
          productId: product.id,
          name: product.name,
          sku: product.sku,
          qty: item.qty,
          unitPrice: item.unitPrice,
          discount: item.discount,
          taxRate: product.taxRate ?? 0,
          tax: round2(lineTax),
          total: round2(lineTotal + lineTax),
        })
      }

      const discount = lineDiscountSum + (body.orderDiscount ?? 0)
      const total = Math.max(0, round2(subtotal - discount + taxSum))
      const paid = body.paid ?? total
      const change = Math.max(0, round2(paid - total))
      const profit = round2(total - taxSum - costTotal)

      // ── Invoice number: INV-YYYYMMDD-#### (sequence per Dhaka day) ──
      const now = new Date()
      const prefix = `INV-${dhakaDateKey(now).replace(/-/g, '')}-`
      const seqCount = await tx.sale.count({ where: { invoiceNo: { startsWith: prefix } } })
      const invoiceNo = `${prefix}${String(seqCount + 1).padStart(4, '0')}`

      const created = await tx.sale.create({
        data: {
          invoiceNo,
          customerId: body.customerId || null,
          subtotal: round2(subtotal),
          discount: round2(discount),
          tax: round2(taxSum),
          total,
          paid: round2(paid),
          change,
          costTotal: round2(costTotal),
          profit,
          paymentMethod: body.paymentMethod,
          status: 'COMPLETED',
          note: body.note ?? null,
          items: { create: itemRows },
        },
      })

      // ── Stock: decrement + ledger rows (handles duplicate product lines) ──
      const stockTracker = new Map<string, number>()
      for (const row of itemRows) {
        const before = stockTracker.has(row.productId)
          ? stockTracker.get(row.productId)!
          : productMap.get(row.productId)!.stock
        const after = before - row.qty
        stockTracker.set(row.productId, after)

        await tx.product.update({
          where: { id: row.productId },
          data: { stock: after },
        })
        await tx.stockMovement.create({
          data: {
            productId: row.productId,
            type: 'SALE',
            qty: -row.qty,
            before,
            after,
            reference: invoiceNo,
          },
        })
      }

      return created
    }, { timeout: 15000 })

    const full = await db.sale.findUnique({
      where: { id: sale.id },
      include: { items: true, customer: true },
    })
    return NextResponse.json(full, { status: 201 })
  } catch (e) {
    if (e instanceof z.ZodError) return bad(zodMsg(e))
    console.error('POST /api/sales error:', e)
    return bad('Failed to create sale', 500)
  }
}
