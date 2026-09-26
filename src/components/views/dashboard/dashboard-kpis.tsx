'use client'

// ── Dashboard: quick actions + KPI row ──────────────────────────────────────
import {
  Banknote,
  Boxes,
  PackagePlus,
  PiggyBank,
  ReceiptText,
  ShoppingCart,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatCard, StatCardSkeleton } from '@/components/shared/stat-card'
import { fmtMoney, fmtMoneyInt } from '@/lib/format'
import type { DashboardData } from '@/lib/types'

const QUICK_ACTIONS = [
  { label: 'New sale', icon: ShoppingCart, view: 'pos' as const, variant: 'default' as const },
  { label: 'Add expense', icon: Wallet, view: 'expenses' as const, variant: 'outline' as const },
  { label: 'Receive stock', icon: PackagePlus, view: 'inventory' as const, variant: 'outline' as const },
]

/** Strip of the three most common jumps, right above the KPIs. */
export function QuickActions({ onNavigate }: { onNavigate: (view: 'pos' | 'expenses' | 'inventory') => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Quick actions">
      {QUICK_ACTIONS.map(({ label, icon: Icon, view, variant }) => (
        <Button key={view} size="sm" variant={variant} onClick={() => onNavigate(view)}>
          <Icon className="size-4" aria-hidden />
          {label}
        </Button>
      ))}
    </div>
  )
}

function pctDelta(current: number, previous: number): number | undefined {
  if (previous <= 0) return undefined
  return ((current - previous) / previous) * 100
}

/** 6 KPI stat cards; renders 6 skeletons while `loading`. */
export function DashboardKpis({ data, loading }: { data: DashboardData | null; loading: boolean }) {
  if (loading || !data) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 2xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  const { today, yesterday, stockValue } = data
  const salesTrend = pctDelta(today.sales, yesterday.sales)
  const profitTrend = pctDelta(today.grossProfit, yesterday.grossProfit)
  const expTrend = pctDelta(today.expenses, yesterday.expenses)
  const yNet = yesterday.grossProfit - yesterday.expenses
  const netTrend = pctDelta(today.netProfit, yNet)
  const netPositive = today.netProfit >= 0

  return (
    <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 2xl:grid-cols-6">
      <StatCard
        title="Today Sales"
        animatedValue={{ value: today.sales, format: (n) => fmtMoneyInt(n) }}
        icon={Banknote}
        trend={salesTrend !== undefined ? { value: salesTrend } : undefined}
        hint={`vs yesterday ${fmtMoney(yesterday.sales, { compact: true })}`}
        accent="bg-gradient-to-r from-primary/80 to-transparent"
      />
      <StatCard
        title="Transactions"
        animatedValue={{ value: today.transactions, format: (n) => Math.round(n).toLocaleString() }}
        icon={ReceiptText}
        hint={`avg basket ${fmtMoney(today.avgBasket, { compact: true })}`}
        accent="bg-gradient-to-r from-primary/40 to-transparent"
      />
      <StatCard
        title="Gross Profit"
        animatedValue={{ value: today.grossProfit, format: (n) => fmtMoneyInt(n) }}
        icon={TrendingUp}
        trend={profitTrend !== undefined ? { value: profitTrend } : undefined}
        hint={`vs yesterday ${fmtMoney(yesterday.grossProfit, { compact: true })}`}
        iconClassName="bg-emerald-500/10"
        accent="bg-gradient-to-r from-emerald-500/80 to-transparent"
      />
      <StatCard
        title="Expenses Today"
        animatedValue={{ value: today.expenses, format: (n) => fmtMoneyInt(n) }}
        icon={Wallet}
        trend={expTrend !== undefined ? { value: expTrend } : undefined}
        trendDownIsGood
        hint={`vs yesterday ${fmtMoney(yesterday.expenses, { compact: true })}`}
        iconClassName="bg-amber-500/10"
        accent="bg-gradient-to-r from-amber-500/80 to-transparent"
      />
      <StatCard
        title="Net Profit"
        animatedValue={{
          value: today.netProfit,
          format: (n) => fmtMoneyInt(n),
        }}
        valueClassName={netPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}
        icon={PiggyBank}
        trend={netTrend !== undefined ? { value: netTrend } : undefined}
        hint="gross profit − expenses"
        iconClassName={netPositive ? 'bg-emerald-500/10' : 'bg-red-500/10'}
        accent={netPositive ? 'bg-gradient-to-r from-emerald-500/80 to-transparent' : 'bg-gradient-to-r from-red-500/80 to-transparent'}
      />
      <StatCard
        title="Stock Value"
        animatedValue={{ value: stockValue.cost, format: (n) => fmtMoney(n, { compact: true }) }}
        icon={Boxes}
        hint={`${stockValue.outOfStock} out of stock, ${stockValue.lowStock} low`}
        iconClassName="bg-violet-500/10"
        accent="bg-gradient-to-r from-violet-500/70 to-transparent"
      />
    </div>
  )
}
