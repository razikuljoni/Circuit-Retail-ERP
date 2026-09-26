'use client'

// ── Dashboard view — daily sales at a glance (landing view) ──────────────────
// Polls /api/dashboard every 60s; all jumps use the shared ui store.
import { useEffect, useRef, useState } from 'react'
import { LayoutDashboard, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader, ErrorState } from '@/components/shared/page-bits'
import { useApi } from '@/hooks/use-api'
import { useUiStore } from '@/store/ui'
import { fmtDate, fmtTime } from '@/lib/format'
import type { DashboardData } from '@/lib/types'
import { DashboardKpis, QuickActions } from './dashboard/dashboard-kpis'
import { DailyTrendCard, HourlySalesCard, PaymentMixCard, TopProductsCard } from './dashboard/dashboard-charts'
import { LowStockCard, RecentExpensesCard, RecentSalesCard } from './dashboard/dashboard-lists'
import { CashDrawerCard } from './dashboard/cash-drawer-card'

/** '12s' | '3m' human age of the last successful fetch. */
function agoLabel(fromMs: number, nowMs: number): string {
  const s = Math.max(0, Math.round((nowMs - fromMs) / 1000))
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m`
}

export default function DashboardView() {
  const setView = useUiStore((s) => s.setView)
  const { data, loading, error, refetch } = useApi<DashboardData>('/api/dashboard', { pollMs: 60000 })

  // Live Dhaka clock for the subtitle (mount-only → hydration safe).
  const [clock, setClock] = useState<string | null>(null)
  useEffect(() => {
    const update = () => setClock(`${fmtDate(new Date())} · ${fmtTime(new Date())}`)
    update()
    const t = setInterval(update, 30000)
    return () => clearInterval(t)
  }, [])

  // "Updated Xs ago" — tracks the last payload that arrived.
  const lastUpdatedRef = useRef<number | null>(null)
  const [tick, setTick] = useState<number | null>(null)
  useEffect(() => {
    if (data) lastUpdatedRef.current = Date.now()
  }, [data])
  useEffect(() => {
    const update = () => setTick(Date.now())
    update()
    const t = setInterval(update, 10000)
    return () => clearInterval(t)
  }, [])

  const [refreshing, setRefreshing] = useState(false)
  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await refetch()
    } finally {
      setRefreshing(false)
    }
  }

  const firstLoad = loading && !data
  const updated =
    tick !== null && lastUpdatedRef.current !== null ? `Updated ${agoLabel(lastUpdatedRef.current, tick)} ago` : null

  return (
    <div className="mx-auto max-w-[1400px] space-y-4 sm:space-y-6">
      <PageHeader
        icon={LayoutDashboard}
        title="Daily Sales Dashboard"
        subtitle={clock ?? undefined}
        actions={
          <>
            {updated && (
              <span
                className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:inline-flex"
                aria-live="polite"
              >
                <span className="relative flex size-2" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                </span>
                LIVE · {updated.replace('Updated ', '').replace(' ago', '')}
              </span>
            )}
            <Button
              variant="outline"
              size="icon"
              className="size-9"
              onClick={handleRefresh}
              disabled={refreshing}
              aria-label="Refresh dashboard"
            >
              <RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden />
            </Button>
          </>
        }
      />

      {error && !data ? (
        <ErrorState message={error} onRetry={handleRefresh} />
      ) : (
        <>
          <QuickActions onNavigate={setView} />

          <DashboardKpis data={data} loading={firstLoad} />

          <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
            <div className="lg:col-span-2">
              <HourlySalesCard data={data} loading={firstLoad} />
            </div>
            <PaymentMixCard data={data} loading={firstLoad} />
          </div>

          <DailyTrendCard data={data} loading={firstLoad} />

          <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
            <TopProductsCard data={data} loading={firstLoad} />
            <LowStockCard data={data} loading={firstLoad} onNavigate={() => setView('inventory')} />
            <CashDrawerCard data={data} loading={firstLoad} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
            <RecentSalesCard data={data} loading={firstLoad} onNavigate={() => setView('sales')} />
            <RecentExpensesCard data={data} loading={firstLoad} onNavigate={() => setView('expenses')} />
          </div>
        </>
      )}
    </div>
  )
}
