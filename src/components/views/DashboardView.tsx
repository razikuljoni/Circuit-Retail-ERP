'use client'

// ── Dashboard view — daily sales at a glance (landing view) ──────────────────
// Live countdown drives the refresh (60s, pausable). A date navigator reviews any
// past Dhaka day: historical views disable auto-refresh (amber chip + subtitle),
// the KPI/chart cards follow via data.isToday / data.viewDate from the API.
import { useCallback, useEffect, useRef, useState } from 'react'
import { CalendarClock, LayoutDashboard, Pause, Play, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader, ErrorState } from '@/components/shared/page-bits'
import { useApi } from '@/hooks/use-api'
import { useUiStore } from '@/store/ui'
import { cn } from '@/lib/utils'
import { qs } from '@/lib/api'
import { addDaysUTC, dayKeyToUTCStart, dhakaDateKey, fmtDate, fmtTime } from '@/lib/format'
import type { DashboardData } from '@/lib/types'
import { DashboardKpis, QuickActions } from './dashboard/dashboard-kpis'
import { DailyTrendCard, HourlySalesCard, PaymentMixCard, TopProductsCard } from './dashboard/dashboard-charts'
import { LowStockCard, RecentExpensesCard, RecentSalesCard } from './dashboard/dashboard-lists'
import { CashDrawerCard } from './dashboard/cash-drawer-card'

const REFRESH_SECS = 60

export default function DashboardView() {
  const setView = useUiStore((s) => s.setView)

  // ── Date navigator: null = live today, else a Dhaka day-key under review ──
  const [viewDate, setViewDate] = useState<string | null>(null)
  // Today's Dhaka key, mounted-only → hydration safe (input max + chip states).
  const [todayKey, setTodayKey] = useState<string | null>(null)
  useEffect(() => {
    setTodayKey(dhakaDateKey(new Date()))
  }, [])
  const yesterdayKey = todayKey ? dhakaDateKey(addDaysUTC(dayKeyToUTCStart(todayKey), -1)) : null
  const isHistorical = viewDate !== null && viewDate !== todayKey
  const viewLabel = viewDate ? fmtDate(viewDate) : null

  // Picking today's own key normalizes back to live (null) — one live representation.
  const pickDate = useCallback(
    (v: string) => setViewDate(!v || v === todayKey ? null : v),
    [todayKey]
  )

  const { data, loading, error, refetch } = useApi<DashboardData>(
    '/api/dashboard' + qs({ date: viewDate ?? undefined })
  )

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
  // Historical views freeze the countdown — auto-refresh only makes sense for today.
  const autoRefreshOff = paused || isHistorical

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
    if (autoRefreshOff) return
    const t = setInterval(() => setSecsLeft((s) => s - 1), 1000)
    return () => clearInterval(t)
  }, [autoRefreshOff])

  const firedRef = useRef(false)
  useEffect(() => {
    if (autoRefreshOff) return
    if (secsLeft <= 0 && !firedRef.current) {
      firedRef.current = true
      void bump()
    }
    if (secsLeft > 0) firedRef.current = false
  }, [secsLeft, autoRefreshOff, bump])

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
        subtitle={isHistorical && viewLabel ? `Sales for ${viewLabel} (historical view)` : (clock ?? undefined)}
        actions={
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {/* Segmented date toolbar — groups the date picker + quick chips */}
            <div
              className="flex items-center gap-1 rounded-lg border bg-card/60 p-1"
              role="group"
              aria-label="Dashboard date selection"
            >
              <Input
                type="date"
                className="h-7 w-[138px] border-0 bg-transparent shadow-none focus-visible:ring-1 dark:[color-scheme:dark]"
                aria-label="View dashboard for date"
                title="Pick a past day to review — future dates are disabled"
                value={viewDate ?? todayKey ?? ''}
                max={todayKey ?? undefined}
                onChange={(e) => pickDate(e.target.value)}
              />
              <span className="h-5 w-px bg-border" aria-hidden />
              <Button
                size="sm"
                variant={viewDate === null ? 'secondary' : 'ghost'}
                className="h-7 px-2.5 text-xs"
                onClick={() => setViewDate(null)}
              >
                Today
              </Button>
              <Button
                size="sm"
                variant={viewDate !== null && viewDate === yesterdayKey ? 'secondary' : 'ghost'}
                className="h-7 px-2.5 text-xs"
                disabled={!yesterdayKey}
                onClick={() => yesterdayKey && setViewDate(yesterdayKey)}
              >
                Yesterday
              </Button>
            </div>
            {isHistorical && viewLabel && (
              <span
                role="status"
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 text-xs font-medium text-amber-700 dark:text-amber-400"
              >
                <CalendarClock className="size-3.5 shrink-0" aria-hidden />
                Viewing {viewLabel} — live refresh off
              </span>
            )}
            {!isHistorical && updatedAgo !== null && (
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
              disabled={isHistorical}
              aria-label={
                isHistorical
                  ? 'Auto-refresh off — viewing a past date'
                  : paused
                    ? 'Resume auto-refresh'
                    : 'Pause auto-refresh'
              }
              title={
                isHistorical
                  ? 'Auto-refresh off — viewing a past date'
                  : paused
                    ? 'Resume auto-refresh'
                    : 'Pause auto-refresh'
              }
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
          </div>
        }
      />

      {error && !data ? (
        <ErrorState message={error} onRetry={() => void bump()} />
      ) : (
        <>
          <QuickActions onNavigate={setView} />

          <DashboardKpis data={data} loading={firstLoad} />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
            <div className="lg:col-span-2">
              <HourlySalesCard data={data} loading={firstLoad} />
            </div>
            <PaymentMixCard data={data} loading={firstLoad} />
          </div>

          <DailyTrendCard data={data} loading={firstLoad} />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
            <TopProductsCard data={data} loading={firstLoad} />
            <LowStockCard data={data} loading={firstLoad} onNavigate={() => setView('inventory')} />
            <CashDrawerCard data={data} loading={firstLoad} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
            <RecentSalesCard data={data} loading={firstLoad} onNavigate={() => setView('sales')} />
            <RecentExpensesCard data={data} loading={firstLoad} onNavigate={() => setView('expenses')} />
          </div>
        </>
      )}
    </div>
  )
}
