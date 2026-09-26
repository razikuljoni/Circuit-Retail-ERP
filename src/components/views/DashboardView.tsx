'use client'

// ── Dashboard view — daily sales at a glance (landing view) ──────────────────
// Live countdown drives the refresh (60s, pausable); all jumps use the shared ui store.
import { useCallback, useEffect, useRef, useState } from 'react'
import { LayoutDashboard, Pause, Play, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader, ErrorState } from '@/components/shared/page-bits'
import { useApi } from '@/hooks/use-api'
import { useUiStore } from '@/store/ui'
import { cn } from '@/lib/utils'
import { fmtDate, fmtTime } from '@/lib/format'
import type { DashboardData } from '@/lib/types'
import { DashboardKpis, QuickActions } from './dashboard/dashboard-kpis'
import { DailyTrendCard, HourlySalesCard, PaymentMixCard, TopProductsCard } from './dashboard/dashboard-charts'
import { LowStockCard, RecentExpensesCard, RecentSalesCard } from './dashboard/dashboard-lists'
import { CashDrawerCard } from './dashboard/cash-drawer-card'

const REFRESH_SECS = 60

export default function DashboardView() {
  const setView = useUiStore((s) => s.setView)
  const { data, loading, error, refetch } = useApi<DashboardData>('/api/dashboard')

  // Live Dhaka clock for the subtitle (mount-only → hydration safe).
  const [clock, setClock] = useState<string | null>(null)
  useEffect(() => {
    const update = () => setClock(`${fmtDate(new Date())} · ${fmtTime(new Date())}`)
    update()
    const t = setInterval(update, 30000)
    return () => clearInterval(t)
  }, [])

  // ── Live countdown + pause/resume (exact sync with the fetch) ──────────────
  const [paused, setPaused] = useState(false)
  const [secsLeft, setSecsLeft] = useState(REFRESH_SECS)
  const [refreshing, setRefreshing] = useState(false)

  const bump = useCallback(async () => {
    setRefreshing(true)
    try {
      await refetch()
    } finally {
      setRefreshing(false)
      setSecsLeft(REFRESH_SECS)
    }
  }, [refetch])

  useEffect(() => {
    if (paused) return
    const t = setInterval(() => setSecsLeft((s) => s - 1), 1000)
    return () => clearInterval(t)
  }, [paused])

  const firedRef = useRef(false)
  useEffect(() => {
    if (paused) return
    if (secsLeft <= 0 && !firedRef.current) {
      firedRef.current = true
      void bump()
    }
    if (secsLeft > 0) firedRef.current = false
  }, [secsLeft, paused, bump])

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

  const firstLoad = loading && !data
  const updatedAgo =
    tick !== null && lastUpdatedRef.current !== null
      ? Math.max(0, Math.round((tick - lastUpdatedRef.current) / 1000))
      : null

  return (
    <div className="mx-auto max-w-[1400px] space-y-4 sm:space-y-6">
      <PageHeader
        icon={LayoutDashboard}
        title="Daily Sales Dashboard"
        subtitle={clock ?? undefined}
        actions={
          <>
            {updatedAgo !== null && (
              <span
                className="hidden items-center gap-2 text-xs text-muted-foreground sm:inline-flex"
                aria-live="polite"
              >
                <span className="relative flex size-2" aria-hidden>
                  <span
                    className={cn(
                      'absolute inline-flex h-full w-full rounded-full opacity-60',
                      paused ? 'bg-amber-400' : 'animate-ping bg-emerald-400'
                    )}
                  />
                  <span className={cn('relative inline-flex size-2 rounded-full', paused ? 'bg-amber-500' : 'bg-emerald-500')} />
                </span>
                <span className="font-medium">{paused ? 'LIVE PAUSED' : 'LIVE'}</span>
                {!paused && (
                  <span className="inline-flex items-center gap-1" title="Next auto-refresh">
                    <svg viewBox="0 0 16 16" className="size-3.5 -rotate-90" aria-hidden>
                      <circle cx="8" cy="8" r="6" fill="none" strokeWidth="2.5" className="stroke-muted" />
                      <circle
                        cx="8"
                        cy="8"
                        r="6"
                        fill="none"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        className="stroke-emerald-500 transition-[stroke-dashoffset] duration-1000 ease-linear"
                        strokeDasharray={2 * Math.PI * 6}
                        strokeDashoffset={2 * Math.PI * 6 * (1 - secsLeft / REFRESH_SECS)}
                      />
                    </svg>
                    <span className="w-6 tabular-nums">{secsLeft}s</span>
                  </span>
                )}
              </span>
            )}
            <Button
              variant="outline"
              size="icon"
              className="size-9"
              onClick={() => setPaused((p) => !p)}
              aria-label={paused ? 'Resume auto-refresh' : 'Pause auto-refresh'}
              title={paused ? 'Resume auto-refresh' : 'Pause auto-refresh'}
            >
              {paused ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-9"
              onClick={() => void bump()}
              disabled={refreshing}
              aria-label="Refresh dashboard"
            >
              <RefreshCw className={cn('size-4', refreshing && 'animate-spin')} aria-hidden />
            </Button>
          </>
        }
      />

      {error && !data ? (
        <ErrorState message={error} onRetry={() => void bump()} />
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
