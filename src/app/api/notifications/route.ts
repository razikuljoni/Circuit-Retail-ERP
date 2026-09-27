// GET /api/notifications — compact live-alert payload for the header bell.
// One response, 4 parallel Prisma queries, select-only fields → cheap enough
// to poll every 60s from every open client. Numbers are computed over the
// current Dhaka day window [startOfTodayUTC, +1d) so they always match
// GET /api/dashboard's live "today" block (same window, same aggregation).
//
// Shape (typed on the client in src/components/app/notification-bell.tsx):
// {
//   lowStock:   [{ id, name, sku, stock, reorderLevel, price }]  ≤8, ratio asc
//   outOfStock: [{ id, name, sku, price }]                       ≤8
//   openShift:  { id, openedAt, openedBy } | null
//   today:      { sales, transactions, expenses }
//   refundedToday: number
//   generatedAt: string (ISO)
// }
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { round2 } from '@/lib/api-utils'
import { startOfTodayUTC, addDaysUTC } from '@/lib/format'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const dayStart = startOfTodayUTC()
    const dayEnd = addDaysUTC(dayStart, 1)

    // ── 4 parallel queries (products + open shift + today's sales + today's expenses) ──
    const [products, openShift, saleGroups, expenseAgg] = await Promise.all([
      db.product.findMany({
        where: { isActive: true },
        select: { id: true, name: true, sku: true, stock: true, reorderLevel: true, price: true },
      }),
      db.shift.findFirst({
        where: { closedAt: null },
        orderBy: { openedAt: 'desc' },
        select: { id: true, openedAt: true, openedBy: true },
      }),
      // One groupBy covers both today's COMPLETED totals and the REFUNDED count
      db.sale.groupBy({
        by: ['status'],
        where: { createdAt: { gte: dayStart, lt: dayEnd } },
        _count: { _all: true },
        _sum: { total: true },
      }),
      db.expense.aggregate({
        where: { spentAt: { gte: dayStart, lt: dayEnd } },
        _sum: { amount: true },
      }),
    ])

    // ── Low stock: active, still on the shelf (stock > 0), at/below reorder level ──
    // Sorted by stock/reorder ratio ascending (closest to running dry first).
    // stock > 0 && stock <= reorderLevel ⇒ reorderLevel > 0, so the ratio is safe.
    const lowStock = products
      .filter((p) => p.stock > 0 && p.stock <= p.reorderLevel)
      .map((p) => ({ p, ratio: p.stock / p.reorderLevel }))
      .sort((a, b) => a.ratio - b.ratio || a.p.stock - b.p.stock || a.p.name.localeCompare(b.p.name))
      .slice(0, 8)
      .map(({ p }) => p)

    // ── Out of stock: active products with nothing on the shelf (≤8, name asc) ──
    const outOfStock = products
      .filter((p) => p.stock <= 0)
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 8)
      .map((p) => ({ id: p.id, name: p.name, sku: p.sku, price: round2(p.price) }))

    // ── Today's numbers (must mirror /api/dashboard exactly) ──
    const completed = saleGroups.find((g) => g.status === 'COMPLETED')
    const refunded = saleGroups.find((g) => g.status === 'REFUNDED')

    return NextResponse.json({
      lowStock: lowStock.map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        stock: p.stock,
        reorderLevel: p.reorderLevel,
        price: round2(p.price),
      })),
      outOfStock,
      openShift: openShift
        ? { id: openShift.id, openedAt: openShift.openedAt, openedBy: openShift.openedBy }
        : null,
      today: {
        sales: round2(completed?._sum.total ?? 0),
        transactions: completed?._count._all ?? 0,
        expenses: round2(expenseAgg._sum.amount ?? 0),
      },
      refundedToday: refunded?._count._all ?? 0,
      generatedAt: new Date().toISOString(),
    })
  } catch (e) {
    console.error('GET /api/notifications error:', e)
    return NextResponse.json({ error: 'Failed to load notifications' }, { status: 500 })
  }
}
