'use client'

import { Banknote } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { fmtMoney } from '@/lib/format'
import type { DashboardData } from '@/lib/types'

/** Cash drawer: cash-in from sales minus cash-out expenses for today. */
export function CashDrawerCard({ data, loading }: { data: DashboardData | null; loading: boolean }) {
  const d = data?.cashDrawer
  const expected = d?.expectedCash ?? 0
  const positive = expected >= 0

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Banknote className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
          Cash drawer (today)
        </CardTitle>
        <CardDescription className="text-xs">Cash in − cash out = what should be in the till</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading || !d ? (
          <div className="space-y-2.5">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-4/5" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : (
          <>
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Banknote className="size-3.5" aria-hidden /> Cash sales
                </span>
                <span className="font-medium tabular-nums">{fmtMoney(d.cashSales)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Banknote className="size-3.5 -scale-x-100" aria-hidden /> Cash expenses
                </span>
                <span className="font-medium tabular-nums text-red-600 dark:text-red-400">
                  −{fmtMoney(d.cashExpenses)}
                </span>
              </div>
            </div>
            <div
              className={`flex items-center justify-between gap-2 rounded-xl border px-3.5 py-3 ${
                positive
                  ? 'border-emerald-500/25 bg-emerald-500/5'
                  : 'border-red-500/25 bg-red-500/5'
              }`}
              aria-live="polite"
            >
              <span className="text-xs font-medium text-muted-foreground">Expected in drawer</span>
              <span
                className={`text-xl font-bold tabular-nums ${
                  positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                }`}
              >
                {fmtMoney(expected)}
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground/80">
              Card · Mobile · Bank sales settle outside the till. Count an opening float before your first cash sale.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
