// GET /api/products/[id]/detail — payload for the product detail drawer:
// product (with category + supplier), 30-day sales stats, recent sale lines
// and the last stock ledger movements (additive, read-only).
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { bad, round2 } from '@/lib/api-utils'
import type { PaymentMethod, SaleStatus } from '@/lib/types'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** Round to 1 decimal (percentages / day estimates) */
function round1(n: number): number {
  return Math.round((Number(n) + Number.EPSILON) * 10) / 10
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  try {
    const product = await db.product.findUnique({
      where: { id },
      include: { category: true, supplier: true },
    })
    if (!product) return bad('Product not found', 404)

    const now = Date.now()
    const since30d = new Date(now - 30 * 86400000)
    const since7d = new Date(now - 7 * 86400000)

    const [statRows, recentRows, movements] = await Promise.all([
      // COMPLETED sale lines in the last 30 days — aggregated in JS
      db.saleItem.findMany({
        where: { productId: id, sale: { status: 'COMPLETED', createdAt: { gte: since30d } } },
        select: {
          qty: true,
          total: true,
          tax: true,
          costPrice: true,
          saleId: true,
          sale: { select: { createdAt: true } },
        },
      }),
      // Last 12 sale lines (any status) for the drawer list — most recent first.
      // SaleItem has no own timestamp → order by the parent sale's createdAt.
      db.saleItem.findMany({
        where: { productId: id, sale: { createdAt: { gte: since30d } } },
        orderBy: { sale: { createdAt: 'desc' } },
        take: 12,
        select: {
          saleId: true,
          qty: true,
          unitPrice: true,
          discount: true,
          tax: true,
          total: true,
          costPrice: true,
          sale: {
            select: {
              invoiceNo: true,
              paymentMethod: true,
              status: true,
              createdAt: true,
              customer: { select: { name: true } },
            },
          },
        },
      }),
      // Last 15 ledger movements for this product
      db.stockMovement.findMany({
        where: { productId: id },
        orderBy: { createdAt: 'desc' },
        take: 15,
      }),
    ])

    // ── Stats (all over COMPLETED sales, last 30 days) ──
    let units30 = 0
    let revenue30 = 0
    let profit30 = 0
    let units7 = 0
    const saleIds = new Set<string>()
    for (const r of statRows) {
      units30 += r.qty
      revenue30 += r.total
      profit30 += r.total - r.tax - r.costPrice * r.qty // line profit
      if (!saleIds.has(r.saleId)) saleIds.add(r.saleId)
      if (r.sale.createdAt.getTime() >= since7d.getTime()) units7 += r.qty
    }

    const avgDailyQty7d = round2(units7 / 7)
    const stats = {
      unitsSold30d: round2(units30),
      revenue30d: round2(revenue30),
      profit30d: round2(profit30),
      orders30d: saleIds.size,
      stockCostValue: round2(product.stock * product.costPrice),
      stockRetailValue: round2(product.stock * product.price),
      marginPct: product.price > 0 ? round1(((product.price - product.costPrice) / product.price) * 100) : null,
      avgDailyQty7d,
      daysCover: avgDailyQty7d > 0 ? round1(product.stock / avgDailyQty7d) : null,
    }

    // ── Recent sale lines ──
    const recentSales = recentRows.map((r) => ({
      saleId: r.saleId,
      invoiceNo: r.sale.invoiceNo,
      qty: r.qty,
      unitPrice: r.unitPrice,
      discount: r.discount,
      tax: r.tax,
      total: r.total,
      costPrice: r.costPrice,
      lineProfit: round2(r.total - r.tax - r.costPrice * r.qty),
      paymentMethod: r.sale.paymentMethod as PaymentMethod,
      status: r.sale.status as SaleStatus,
      customerName: r.sale.customer?.name ?? null,
      createdAt: r.sale.createdAt.toISOString(),
    }))

    return NextResponse.json({
      // Product shape mirrors GET /api/products (incl. 7-day velocity fields)
      product: {
        ...product,
        avgDailyQty: avgDailyQty7d,
        daysCover: stats.daysCover,
      },
      stats,
      recentSales,
      movements,
    })
  } catch (e) {
    console.error('GET /api/products/[id]/detail error:', e)
    return bad('Failed to load product detail', 500)
  }
}
