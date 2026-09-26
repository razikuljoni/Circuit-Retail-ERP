// GET /api/reports?type=pnl|products|daily&from=YYYY-MM-DD&to=YYYY-MM-DD
// All boundaries are Dhaka day keys; dates default to the last 30 days.
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  bad,
  round2,
  dayRangeFromKeys,
  dayKeysBetween,
  dayKeyLabel,
} from '@/lib/api-utils'
import { dhakaDateKey } from '@/lib/format'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const type = sp.get('type') ?? 'pnl'
    const { start, end, fromKey, toKey } = dayRangeFromKeys(sp.get('from'), sp.get('to'), 29)

    if (type === 'pnl') return NextResponse.json(await pnlReport(start, end, fromKey, toKey))
    if (type === 'products') return NextResponse.json(await productPerformance(start, end))
    if (type === 'daily') return NextResponse.json(await dailyReport(start, end))
    return bad(`Unknown report type "${type}" (expected pnl | products | daily)`)
  } catch (e) {
    console.error('GET /api/reports error:', e)
    return bad('Failed to build report', 500)
  }
}

async function pnlReport(start: Date, end: Date, fromKey: string, toKey: string) {
  const completedWhere = { status: 'COMPLETED', createdAt: { gte: start, lt: end } }
  const [completedAgg, refundedAgg, expenses] = await Promise.all([
    db.sale.aggregate({
      where: completedWhere,
      _count: true,
      _sum: { total: true, discount: true, tax: true, costTotal: true, profit: true },
    }),
    db.sale.aggregate({
      where: { status: 'REFUNDED', createdAt: { gte: start, lt: end } },
      _sum: { total: true },
    }),
    db.expense.findMany({
      where: { spentAt: { gte: start, lt: end } },
      include: { category: true },
    }),
  ])

  const revenue = round2(completedAgg._sum.total ?? 0)
  const grossProfit = round2(completedAgg._sum.profit ?? 0)
  const expensesTotal = round2(expenses.reduce((s, e) => s + e.amount, 0))

  const catMap = new Map<string, { name: string; color: string | null; amount: number }>()
  for (const e of expenses) {
    const key = e.categoryId ?? '__none__'
    const entry = catMap.get(key) ?? {
      name: e.category?.name ?? 'Uncategorized',
      color: e.category?.color ?? null,
      amount: 0,
    }
    entry.amount += e.amount
    catMap.set(key, entry)
  }

  const transactions = completedAgg._count
  return {
    from: fromKey,
    to: toKey,
    revenue,
    refunds: round2(refundedAgg._sum.total ?? 0),
    discounts: round2(completedAgg._sum.discount ?? 0),
    tax: round2(completedAgg._sum.tax ?? 0),
    cogs: round2(completedAgg._sum.costTotal ?? 0),
    grossProfit,
    expensesTotal,
    expensesByCategory: [...catMap.values()]
      .map((c) => ({ ...c, amount: round2(c.amount) }))
      .sort((a, b) => b.amount - a.amount),
    netProfit: round2(grossProfit - expensesTotal),
    transactions,
    avgBasket: transactions > 0 ? round2(revenue / transactions) : 0,
  }
}

async function productPerformance(start: Date, end: Date) {
  const items = await db.saleItem.findMany({
    where: {
      sale: { status: 'COMPLETED', createdAt: { gte: start, lt: end } },
      productId: { not: null },
    },
    select: { productId: true, name: true, sku: true, qty: true, total: true, tax: true, costPrice: true },
  })

  const map = new Map<string, { name: string; sku: string; qty: number; revenue: number; profit: number }>()
  for (const it of items) {
    if (!it.productId) continue
    const entry = map.get(it.productId) ?? { name: it.name, sku: it.sku, qty: 0, revenue: 0, profit: 0 }
    entry.qty += it.qty
    entry.revenue += it.total
    entry.profit += it.total - it.tax - it.costPrice * it.qty
    map.set(it.productId, entry)
  }

  return [...map.entries()]
    .map(([id, v]) => ({
      id,
      name: v.name,
      sku: v.sku,
      qty: round2(v.qty),
      revenue: round2(v.revenue),
      profit: round2(v.profit),
      margin: v.revenue > 0 ? round2((v.profit / v.revenue) * 100) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 50)
}

async function dailyReport(start: Date, end: Date) {
  // Cap the range to 366 days to keep the per-day loop bounded
  const cappedStart = new Date(Math.max(start.getTime(), end.getTime() - 366 * 86400000))
  const keys = dayKeysBetween(cappedStart, end)

  const [sales, expenses] = await Promise.all([
    db.sale.findMany({
      where: { createdAt: { gte: cappedStart, lt: end } },
      select: { createdAt: true, status: true, total: true, discount: true, costTotal: true, profit: true },
    }),
    db.expense.findMany({
      where: { spentAt: { gte: cappedStart, lt: end } },
      select: { amount: true, spentAt: true },
    }),
  ])

  const byDay = new Map<
    string,
    { transactions: number; gross: number; discounts: number; refunds: number; cogs: number; profit: number }
  >()
  for (const s of sales) {
    const key = dhakaDateKey(s.createdAt)
    const day = byDay.get(key) ?? { transactions: 0, gross: 0, discounts: 0, refunds: 0, cogs: 0, profit: 0 }
    day.transactions += 1
    if (s.status === 'COMPLETED') {
      day.gross += s.total
      day.discounts += s.discount
      day.cogs += s.costTotal
      day.profit += s.profit
    } else {
      day.refunds += s.total
    }
    byDay.set(key, day)
  }

  const expByDay = new Map<string, number>()
  for (const e of expenses) {
    const key = dhakaDateKey(e.spentAt)
    expByDay.set(key, (expByDay.get(key) ?? 0) + e.amount)
  }

  return keys.map((key) => {
    const day = byDay.get(key) ?? { transactions: 0, gross: 0, discounts: 0, refunds: 0, cogs: 0, profit: 0 }
    const expensesAmt = expByDay.get(key) ?? 0
    return {
      date: key,
      label: dayKeyLabel(key),
      transactions: day.transactions,
      gross: round2(day.gross),
      discounts: round2(day.discounts),
      refunds: round2(day.refunds),
      net: round2(day.gross),
      cogs: round2(day.cogs),
      profit: round2(day.profit),
      expenses: round2(expensesAmt),
    }
  })
}
