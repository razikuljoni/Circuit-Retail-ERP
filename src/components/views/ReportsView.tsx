'use client'

// ── Reports view — P&L, product performance and daily summary ────────────────
// Range is Dhaka day keys; defaults to the last 7 days ending today.
import { useMemo, useState, useSyncExternalStore } from 'react'
import { BarChart3 } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { PageHeader, ErrorState } from '@/components/shared/page-bits'
import { useApi } from '@/hooks/use-api'
import { qs } from '@/lib/api'
import { daysAgoKey, todayKey } from './reports/reports-utils'
import type { DailySalesRow, PnlReport, ProductPerformance } from '@/lib/types'
import { ControlsCard } from './reports/reports-controls'
import { PnlTab } from './reports/reports-pnl'
import { DailyTab, ProductsTab, TableSkeleton } from './reports/reports-tables'
import type { ReportType } from './reports/reports-utils'

type ReportsPayload = PnlReport | ProductPerformance[] | DailySalesRow[]

/**
 * Today's Dhaka day key, hydration-safe: server/hydration pass renders null,
 * then React re-renders with the real key right after mount (no mismatch).
 */
const subscribeNoop = () => () => {}
function useTodayKey(): string | null {
  return useSyncExternalStore(subscribeNoop, () => todayKey(), () => null)
}

export default function ReportsView() {
  const [tab, setTab] = useState<ReportType>('pnl')
  const [override, setOverride] = useState<{ from: string; to: string } | null>(null)
  const today = useTodayKey()

  // Effective range: user override wins, otherwise "last 7 days ending today".
  const range = useMemo(() => {
    if (override) return override
    if (!today) return null
    return { from: daysAgoKey(6), to: today }
  }, [override, today])

  const url = useMemo(() => {
    if (!range) return null
    // Guard against an inverted range (from after to).
    const [f, t] = range.from <= range.to ? [range.from, range.to] : [range.to, range.from]
    return `/api/reports${qs({ type: tab, from: f, to: t })}`
  }, [tab, range])

  const { data, loading, error, refetch } = useApi<ReportsPayload>(url)

  const showSkeleton = loading || !data

  return (
    <div className="mx-auto max-w-[1400px] space-y-4 sm:space-y-6">
      <PageHeader
        icon={BarChart3}
        title="Reports & Analytics"
        subtitle="P&L, product performance and daily summary"
      />

      <ControlsCard
        tab={tab}
        onTabChange={setTab}
        from={range?.from ?? ''}
        to={range?.to ?? ''}
        onRangeChange={setOverride}
      />

      {error && !data ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : showSkeleton ? (
        <Card className="gap-4">
          <CardHeader>
            <div className="h-5 w-40 animate-pulse rounded-md bg-muted" />
          </CardHeader>
          <CardContent>
            <TableSkeleton rows={7} />
          </CardContent>
        </Card>
      ) : tab === 'pnl' ? (
        <PnlTab data={data as PnlReport} from={range!.from} to={range!.to} />
      ) : tab === 'products' ? (
        <ProductsTab data={data as ProductPerformance[]} from={range!.from} to={range!.to} />
      ) : (
        <DailyTab data={data as DailySalesRow[]} from={range!.from} to={range!.to} />
      )}
    </div>
  )
}
