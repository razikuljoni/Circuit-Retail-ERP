'use client'

// ── Reports: P&L tab (stat row + waterfall breakdown + expense split) ───────
import { useMemo } from 'react'
import { AlertTriangle, CalendarOff, Coins, PiggyBank, ReceiptText, TrendingUp, Wallet } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/shared/stat-card'
import { EmptyState } from '@/components/shared/page-bits'
import { dayKeyToUTCStart, fmtDate, fmtMoney, fmtMoneyInt } from '@/lib/format'
import type { PnlReport } from '@/lib/types'

function rangeLabel(from: string, to: string): string {
  return `${fmtDate(dayKeyToUTCStart(from))} → ${fmtDate(dayKeyToUTCStart(to))}`
}

function WaterfallRow({
  label,
  value,
  tone = 'plain',
  bold = false,
}: {
  label: string
  value: number
  tone?: 'plain' | 'minus' | 'equals'
  bold?: boolean
}) {
  const colored =
    tone === 'equals' && label === 'Net Profit'
      ? value >= 0
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-red-600 dark:text-red-400'
      : ''
  return (
    <div
      className={`flex items-center justify-between gap-4 py-1.5 text-sm ${bold ? 'border-t pt-2.5 font-semibold' : ''}`}
    >
      <span className={`text-muted-foreground ${bold ? 'text-foreground' : ''}`}>
        {tone === 'minus' && <span className="mr-1" aria-hidden>−</span>}
        {tone === 'equals' && <span className="mr-1" aria-hidden>=</span>}
        {label}
      </span>
      <span className={`tabular-nums ${bold ? '' : 'font-medium'} ${colored}`}>{fmtMoney(value)}</span>
    </div>
  )
}

export function PnlTab({ data, from, to }: { data: PnlReport; from: string; to: string }) {
  const isEmpty = data.transactions === 0 && data.revenue === 0

  const categoryRows = useMemo(
    () =>
      [...data.expensesByCategory]
        .sort((a, b) => b.amount - a.amount)
        .map((c) => ({
          ...c,
          share:
            data.expensesTotal > 0 ? Math.min(100, Math.max(0, (c.amount / data.expensesTotal) * 100)) : 0,
        })),
    [data.expensesByCategory, data.expensesTotal]
  )

  if (isEmpty) {
    return (
      <Card>
        <CardContent className="py-6">
          <EmptyState
            icon={CalendarOff}
            title="No data in this range"
            message={`There were no transactions between ${rangeLabel(from, to)}.`}
          />
        </CardContent>
      </Card>
    )
  }

  const netPositive = data.netProfit >= 0

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-3 2xl:grid-cols-5">
        <StatCard title="Revenue" value={fmtMoneyInt(data.revenue)} icon={Coins} hint={`${data.transactions} transactions`} />
        <StatCard
          title="Gross Profit"
          value={fmtMoneyInt(data.grossProfit)}
          icon={TrendingUp}
          iconClassName="bg-emerald-500/10"
          hint={`after ${fmtMoney(data.cogs, { compact: true })} COGS`}
        />
        <StatCard
          title="Expenses"
          value={fmtMoneyInt(data.expensesTotal)}
          icon={Wallet}
          iconClassName="bg-amber-500/10"
          hint={`${data.expensesByCategory.length} categories`}
        />
        <StatCard
          title="Net Profit"
          value={
            <span className={netPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
              {fmtMoneyInt(data.netProfit)}
            </span>
          }
          icon={PiggyBank}
          iconClassName={netPositive ? 'bg-emerald-500/10' : 'bg-red-500/10'}
          hint="gross profit − expenses"
        />
        <StatCard
          title="Transactions"
          value={data.transactions}
          icon={ReceiptText}
          hint={`avg basket ${fmtMoney(data.avgBasket, { compact: true })}`}
        />
      </div>

      <Card className="gap-4">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">P&amp;L breakdown</CardTitle>
          <CardDescription className="text-xs">{rangeLabel(from, to)}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          {/* Left: waterfall */}
          <div aria-label="Profit and loss breakdown">
            <WaterfallRow label="Revenue" value={data.revenue} />
            <WaterfallRow label="Refunds" value={data.refunds} tone="minus" />
            <WaterfallRow label="Discounts" value={data.discounts} tone="minus" />
            <WaterfallRow label="COGS" value={data.cogs} tone="minus" />
            <WaterfallRow label="Gross Profit" value={data.grossProfit} tone="equals" bold />
            <WaterfallRow label="Expenses" value={data.expensesTotal} tone="minus" />
            <WaterfallRow label="Net Profit" value={data.netProfit} tone="equals" bold />
            {data.refunds > 0 && (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
                Includes {fmtMoney(data.refunds)} refunds
              </p>
            )}
          </div>

          {/* Right: expenses by category */}
          <div aria-label="Expenses by category">
            <h3 className="mb-2 text-sm font-semibold">Expenses by category</h3>
            {categoryRows.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No expenses in this range.</p>
            ) : (
              <div className="space-y-3">
                {categoryRows.map((c) => (
                  <div key={c.name}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: c.color || 'var(--chart-2)' }}
                          aria-hidden
                        />
                        <span className="truncate">{c.name}</span>
                      </span>
                      <span className="flex shrink-0 items-baseline gap-2">
                        <span className="text-xs text-muted-foreground tabular-nums">{c.share.toFixed(0)}%</span>
                        <span className="font-medium tabular-nums">{fmtMoney(c.amount)}</span>
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${c.share}%`, backgroundColor: c.color || 'var(--chart-2)' }}
                        role="img"
                        aria-label={`${c.name} share ${c.share.toFixed(0)}%`}
                      />
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t pt-2.5 text-sm font-semibold">
                  <span>Total expenses</span>
                  <span className="tabular-nums">{fmtMoney(data.expensesTotal)}</span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
