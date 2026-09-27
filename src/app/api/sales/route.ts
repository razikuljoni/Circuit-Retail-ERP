// GET  /api/sales — filtered sales list with summary (whole filtered set)
// POST /api/sales — THE CORE POS ENDPOINT (transactional: sale + items + stock movements)
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { bad, zodMsg, round2, isDayKey, numParam, nextDocNumber } from '@/lib/api-utils'
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

/** Outstanding credit for a sale (total − paid, when positive). */
function dueOf(s: { total: number; paid: number }): number {
  return Math.max(0, round2(s.total - s.paid))
}

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
      sales: sales.map((s) => ({ ...s, due: dueOf(s) })),
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

    // Pre-compute rough total to enforce the credit rule (partial payment needs a customer)
    if (body.paid !== undefined) {
      let roughSubtotal = 0
      for (const item of body.items) roughSubtotal += item.unitPrice * item.qty - (item.discount ?? 0)
      const roughTotal = Math.max(0, round2(roughSubtotal - (body.orderDiscount ?? 0)))
      if (round2(body.paid) < roughTotal - 0.001 && !body.customerId) {
        return bad('Credit sales (partial payment) require a customer — select one at the top of the cart')
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
        imageUrl: string | null
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
          costPrice: product.costPrice,
          // Snapshot the product photo at sale time (receipt/detail thumbnails);
          // stays null for products without an image and for legacy sale rows.
          imageUrl: product.imageUrl,
        })
      }

      const discount = lineDiscountSum + (body.orderDiscount ?? 0)
      const total = Math.max(0, round2(subtotal - discount + taxSum))
      const paid = body.paid ?? total
      const change = Math.max(0, round2(paid - total))
      const profit = round2(total - taxSum - costTotal)

      // Exact credit rule: a partially-paid sale must belong to a customer
      if (round2(paid) < total - 0.001 && !body.customerId) {
        throw new Error('Credit sales (partial payment) require a customer — select one at the top of the cart')
      }

      // Credit-limit enforcement: new due + existing outstanding must fit the ceiling
      const newDue = Math.max(0, round2(total - paid))
      if (newDue > 0 && body.customerId) {
        const customer = await tx.customer.findUnique({
          where: { id: body.customerId },
          select: { name: true, creditLimit: true },
        })
        if (!customer) throw new Error('Selected customer no longer exists — refresh and try again')
        if (customer.creditLimit !== null && customer.creditLimit !== undefined) {
          const outstandingRows = await tx.sale.findMany({
            where: { customerId: body.customerId, status: 'COMPLETED' },
            select: { total: true, paid: true },
          })
          const outstanding = round2(
            outstandingRows.reduce((sum, s) => sum + Math.max(0, s.total - s.paid), 0)
          )
          const limit = round2(customer.creditLimit)
          if (round2(outstanding + newDue) > limit + 0.001) {
            const remaining = Math.max(0, round2(limit - outstanding))
            throw new Error(
              `Credit limit exceeded for ${customer.name} — limit ${limit.toFixed(2)}, ` +
                `already due ${outstanding.toFixed(2)}, only ${remaining.toFixed(2)} available. ` +
                `Collect the balance or raise the limit in Customers.`
            )
          }
        }
      }

      // ── Invoice number: INV-YYYYMMDD-#### (gap-safe max+1 per Dhaka day) ──
      const now = new Date()
      const prefix = `INV-${dhakaDateKey(now).replace(/-/g, '')}-`
      const existingInvoices = await tx.sale.findMany({
        where: { invoiceNo: { startsWith: prefix } },
        select: { invoiceNo: true },
      })
      const invoiceNo = nextDocNumber(prefix, existingInvoices.map((r) => r.invoiceNo))

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
    return NextResponse.json(full ? { ...full, due: dueOf(full) } : full, { status: 201 })
  } catch (e) {
    if (e instanceof z.ZodError) return bad(zodMsg(e))
    if (e instanceof Error && (e.message.startsWith('Credit sales') || e.message.startsWith('Credit limit exceeded') || e.message.startsWith('Selected customer'))) {
      return bad(e.message)
    }
    console.error('POST /api/sales error:', e)
    return bad('Failed to create sale', 500)
  }
}
