// GET /api/dashboard — single JSON matching DashboardData (src/lib/types.ts)
// Optional ?date=YYYY-MM-DD (Dhaka day-key) reviews a past day instead of live today:
// the `today` KPI block becomes the selected day, `yesterday` becomes its previous day
// (so all "% vs yesterday" comparisons keep working unchanged). Trend/top-products stay
// relative to today; hourly/payment-mix/cash-drawer follow the selected day.
import { NextResponse } from 'next/server'
import { db, ensureDbInitialized } from '@/lib/db'
import {
  round2,
  hourLabel,
  dayKeyLabel,
  dhakaHour,
  isDayKey,
  bad,
} from '@/lib/api-utils'
import {
  startOfTodayUTC,
  addDaysUTC,
  dhakaDateKey,
  dayKeyToUTCStart,
  dayKeyToUTCEnd,
} from '@/lib/format'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    await ensureDbInitialized()
    // ── Optional ?date= review param (format-valid + real calendar day) ──
    const dateParam = new URL(req.url).searchParams.get('date')
    if (
      dateParam !== null &&
      (!isDayKey(dateParam) || dhakaDateKey(dayKeyToUTCStart(dateParam)) !== dateParam)
    ) {
      return bad('Invalid date — expected YYYY-MM-DD')
    }

    const todayStart = startOfTodayUTC()
    const tomorrow = addDaysUTC(todayStart, 1)
    const d7Start = addDaysUTC(todayStart, -6)
    const d14Start = addDaysUTC(todayStart, -13)

    // ── Selected day: today (no param, backwards compatible) or the ?date= Dhaka day ──
    const viewDate = dateParam ?? dhakaDateKey(todayStart)
    const isToday = viewDate === dhakaDateKey(todayStart)
    const selStart = isToday ? todayStart : dayKeyToUTCStart(viewDate)
    const selEnd = isToday ? tomorrow : dayKeyToUTCEnd(viewDate)
    const prevStart = addDaysUTC(selStart, -1) // previous Dhaka day of the selection
    const prevEnd = selStart

    // Fetch window covers the 14-day trend AND the selected + previous day
    const windowStart = new Date(Math.min(d14Start.getTime(), prevStart.getTime()))
    const windowEnd = new Date(Math.max(tomorrow.getTime(), selEnd.getTime()))

    // ── One fetch for the whole window of sales (with item snapshots) ──
    const sales = await db.sale.findMany({
      where: { createdAt: { gte: windowStart, lt: windowEnd } },
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

    // ── Same window of expenses ──
    const expenses = await db.expense.findMany({
      where: { spentAt: { gte: windowStart, lt: windowEnd } },
      select: { amount: true, spentAt: true, paymentMethod: true },
    })

    // ── Selected-day + previous-day aggregates (from the window fetch) ──
    let tSales = 0, tTx = 0, tProfit = 0, tDiscounts = 0, tRefunds = 0
    let ySales = 0, yTx = 0, yProfit = 0
    const hourlySales = Array(24).fill(0)
    const hourlyTx = Array(24).fill(0)
    const payMix = new Map<string, { amount: number; count: number }>()

    for (const s of sales) {
      const at = s.createdAt.getTime()
      const isSel = at >= selStart.getTime() && at < selEnd.getTime()
      const isPrevDay = at >= prevStart.getTime() && at < prevEnd.getTime()
      const completed = s.status === 'COMPLETED'

      if (isSel && completed) {
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
      if (isSel && s.status === 'REFUNDED') {
        tRefunds += s.total
      }
      if (isPrevDay && completed) {
        ySales += s.total
        yTx += 1
        yProfit += s.profit
      }
    }

    let tExpenses = 0
    let yExpenses = 0
    let selCashExpenses = 0
    const dailyExpenses = new Map<string, number>()
    for (const e of expenses) {
      const at = e.spentAt.getTime()
      if (at >= selStart.getTime() && at < selEnd.getTime()) {
        tExpenses += e.amount
        if (e.paymentMethod === 'CASH') selCashExpenses += e.amount
      }
      if (at >= prevStart.getTime() && at < prevEnd.getTime()) yExpenses += e.amount
      const key = dhakaDateKey(e.spentAt)
      dailyExpenses.set(key, (dailyExpenses.get(key) ?? 0) + e.amount)
    }

    const cashSales = payMix.get('CASH')?.amount ?? 0
    const cashDrawer = {
      cashSales: round2(cashSales),
      cashExpenses: round2(selCashExpenses),
      expectedCash: round2(cashSales - selCashExpenses),
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

    // ── Hourly buckets (selected day, Dhaka hours) ──
    const hourly = Array.from({ length: 24 }, (_, h) => ({
      hour: String(h),
      label: hourLabel(h),
      sales: round2(hourlySales[h]),
      transactions: hourlyTx[h],
    }))

    // ── Last 14 Dhaka days ascending (always relative to TODAY — unchanged) ──
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

    // ── Payment mix (selected day, COMPLETED) ──
    const paymentMix = [...payMix.entries()]
      .map(([method, v]) => ({ method, amount: round2(v.amount), count: v.count }))
      .sort((a, b) => b.amount - a.amount)

    // ── Top products (last 7 days relative to TODAY — unchanged, COMPLETED, by qty) ──
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

    // ── Recent lists (global latest — kept as-is) ──
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
      viewDate,
      isToday,
    })
  } catch (e) {
    console.error('GET /api/dashboard error:', e)
    return NextResponse.json({ error: 'Failed to load dashboard' }, { status: 500 })
  }
}
