// GET /api/dashboard — single JSON matching DashboardData (src/lib/types.ts)
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  round2,
  hourLabel,
  dayKeyLabel,
  dhakaHour,
} from '@/lib/api-utils'
import {
  startOfTodayUTC,
  addDaysUTC,
  dhakaDateKey,
} from '@/lib/format'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const todayStart = startOfTodayUTC()
    const tomorrow = addDaysUTC(todayStart, 1)
    const yesterdayStart = addDaysUTC(todayStart, -1)
    const d7Start = addDaysUTC(todayStart, -6)
    const d14Start = addDaysUTC(todayStart, -13)

    // ── One fetch for 14 days of sales (with item snapshots) ──
    const sales = await db.sale.findMany({
      where: { createdAt: { gte: d14Start, lt: tomorrow } },
      select: {
        id: true,
        createdAt: true,
        status: true,
        paymentMethod: true,
        total: true,
        discount: true,
        tax: true,
        profit: true,
        costTotal: true,
        items: { select: { name: true, sku: true, qty: true, total: true, tax: true, costPrice: true } },
      },
    })

    // ── 14 days of expenses ──
    const expenses = await db.expense.findMany({
      where: { spentAt: { gte: d14Start, lt: tomorrow } },
      select: { amount: true, spentAt: true, paymentMethod: true },
    })

    // ── Today + yesterday aggregates (from the 14-day fetch) ──
    let tSales = 0, tTx = 0, tProfit = 0, tDiscounts = 0, tRefunds = 0
    let ySales = 0, yTx = 0, yProfit = 0
    const hourlySales = Array(24).fill(0)
    const hourlyTx = Array(24).fill(0)
    const payMix = new Map<string, { amount: number; count: number }>()

    for (const s of sales) {
      const at = s.createdAt.getTime()
      const isToday = at >= todayStart.getTime() && at < tomorrow.getTime()
      const isYesterday = at >= yesterdayStart.getTime() && at < todayStart.getTime()
      const completed = s.status === 'COMPLETED'

      if (isToday && completed) {
        tSales += s.total
        tTx += 1
        tProfit += s.profit
        tDiscounts += s.discount
        const h = dhakaHour(s.createdAt)
        hourlySales[h] += s.total
        hourlyTx[h] += 1
        const m = payMix.get(s.paymentMethod) ?? { amount: 0, count: 0 }
        m.amount += s.total
        m.count += 1
        payMix.set(s.paymentMethod, m)
      }
      if (isToday && s.status === 'REFUNDED') {
        tRefunds += s.total
      }
      if (isYesterday && completed) {
        ySales += s.total
        yTx += 1
        yProfit += s.profit
      }
    }

    let tExpenses = 0
    let yExpenses = 0
    let todayCashExpenses = 0
    const dailyExpenses = new Map<string, number>()
    for (const e of expenses) {
      const at = e.spentAt.getTime()
      if (at >= todayStart.getTime() && at < tomorrow.getTime()) {
        tExpenses += e.amount
        if (e.paymentMethod === 'CASH') todayCashExpenses += e.amount
      }
      if (at >= yesterdayStart.getTime() && at < todayStart.getTime()) yExpenses += e.amount
      const key = dhakaDateKey(e.spentAt)
      dailyExpenses.set(key, (dailyExpenses.get(key) ?? 0) + e.amount)
    }

    const cashSales = payMix.get('CASH')?.amount ?? 0
    const cashDrawer = {
      cashSales: round2(cashSales),
      cashExpenses: round2(todayCashExpenses),
      expectedCash: round2(cashSales - todayCashExpenses),
    }

    const today = {
      sales: round2(tSales),
      transactions: tTx,
      avgBasket: tTx > 0 ? round2(tSales / tTx) : 0,
      grossProfit: round2(tProfit),
      expenses: round2(tExpenses),
      netProfit: round2(tProfit - tExpenses),
      discounts: round2(tDiscounts),
      refunds: round2(tRefunds),
    }

    const yesterday = {
      sales: round2(ySales),
      transactions: yTx,
      grossProfit: round2(yProfit),
      expenses: round2(yExpenses),
    }

    // ── Hourly buckets (today, Dhaka hours) ──
    const hourly = Array.from({ length: 24 }, (_, h) => ({
      hour: String(h),
      label: hourLabel(h),
      sales: round2(hourlySales[h]),
      transactions: hourlyTx[h],
    }))

    // ── Last 14 Dhaka days ascending ──
    const daily: { date: string; label: string; sales: number; expenses: number; profit: number }[] = []
    const dailyProfitMap = new Map<string, number>()
    for (const s of sales) {
      if (s.status !== 'COMPLETED') continue
      const key = dhakaDateKey(s.createdAt)
      dailyProfitMap.set(key, (dailyProfitMap.get(key) ?? 0) + s.profit)
    }
    for (let i = 0; i < 14; i++) {
      const dayStart = addDaysUTC(d14Start, i)
      const key = dhakaDateKey(dayStart)
      const daySales = sales
        .filter((s) => s.status === 'COMPLETED' && dhakaDateKey(s.createdAt) === key)
        .reduce((sum, s) => sum + s.total, 0)
      const dayExp = dailyExpenses.get(key) ?? 0
      daily.push({
        date: key,
        label: dayKeyLabel(key),
        sales: round2(daySales),
        expenses: round2(dayExp),
        profit: round2((dailyProfitMap.get(key) ?? 0) - dayExp),
      })
    }

    // ── Payment mix (today, COMPLETED) ──
    const paymentMix = [...payMix.entries()]
      .map(([method, v]) => ({ method, amount: round2(v.amount), count: v.count }))
      .sort((a, b) => b.amount - a.amount)

    // ── Top products (last 7 days, COMPLETED, by qty) ──
    const topMap = new Map<string, { qty: number; revenue: number }>()
    for (const s of sales) {
      if (s.status !== 'COMPLETED') continue
      if (s.createdAt.getTime() < d7Start.getTime()) continue
      for (const it of s.items) {
        const entry = topMap.get(it.name) ?? { qty: 0, revenue: 0 }
        entry.qty += it.qty
        entry.revenue += it.total
        topMap.set(it.name, entry)
      }
    }
    const topProducts = [...topMap.entries()]
      .map(([name, v]) => ({ name, qty: round2(v.qty), revenue: round2(v.revenue) }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5)

    // ── Recent lists ──
    const [recentSales, recentExpenses] = await Promise.all([
      db.sale.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: { customer: true, items: true },
      }),
      db.expense.findMany({
        orderBy: { spentAt: 'desc' },
        take: 8,
        include: { category: true },
      }),
    ])

    // ── Low stock + stock valuation (JS aggregation over active products) ──
    const activeProducts = await db.product.findMany({
      where: { isActive: true },
      include: { category: true },
    })

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
    const velocityOf = (p: { id: string; stock: number }) => {
      const avgDailyQty = Math.round(((velMap.get(p.id) ?? 0) / 7) * 100) / 100
      const daysCover = avgDailyQty > 0 ? Math.round((p.stock / avgDailyQty) * 10) / 10 : null
      return { avgDailyQty, daysCover }
    }

    const lowStock = activeProducts
      .filter((p) => p.stock <= p.reorderLevel)
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 12)
      .map((p) => ({ ...p, ...velocityOf(p) }))

    let vCost = 0, vRetail = 0, outOfStock = 0, lowStockCount = 0
    for (const p of activeProducts) {
      vCost += p.stock * p.costPrice
      vRetail += p.stock * p.price
      if (p.stock <= 0) outOfStock += 1
      else if (p.stock <= p.reorderLevel) lowStockCount += 1
    }

    const stockValue = {
      cost: round2(vCost),
      retail: round2(vRetail),
      products: activeProducts.length,
      outOfStock,
      lowStock: lowStockCount,
    }

    return NextResponse.json({
      today,
      yesterday,
      hourly,
      daily,
      paymentMix,
      topProducts,
      recentSales,
      recentExpenses,
      lowStock,
      stockValue,
      cashDrawer,
    })
  } catch (e) {
    console.error('GET /api/dashboard error:', e)
    return NextResponse.json({ error: 'Failed to load dashboard' }, { status: 500 })
  }
}
