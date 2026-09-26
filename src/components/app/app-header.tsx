'use client'

// ── Sticky app header: brand, clock, quick actions, theme, alerts ────────────
import { useEffect, useState, useSyncExternalStore } from 'react'
import { useTheme } from 'next-themes'
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  CheckCircle2,
  Menu,
  Moon,
  Plus,
  Store,
  Sun,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useUiStore } from '@/store/ui'
import { fmtDate, fmtTime } from '@/lib/format'
import type { DashboardData, Product } from '@/lib/types'
import { cn } from '@/lib/utils'

// Mounted check via external store → SSR/hydration render false, client true.
function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )
}

// 30s time-bucket subscription: snapshot is stable, ticks re-render on change.
const CLOCK_BUCKET_MS = 30_000
function useClockBucket() {
  return useSyncExternalStore(
    (onChange) => {
      const id = setInterval(onChange, CLOCK_BUCKET_MS)
      return () => clearInterval(id)
    },
    () => Math.floor(Date.now() / CLOCK_BUCKET_MS),
    () => Math.floor(Date.now() / CLOCK_BUCKET_MS)
  )
}

/** Live Dhaka clock — updates every 30s, hydration-safe (no state in effect). */
function LiveClock() {
  const bucket = useClockBucket()
  const now = new Date(bucket * CLOCK_BUCKET_MS)

  return (
    <div
      className="hidden items-center gap-2 rounded-md border bg-muted/40 px-3 py-1.5 md:flex"
      title="Current time — Asia/Dhaka"
    >
      <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="whitespace-nowrap text-sm tabular-nums text-foreground">
        {fmtDate(now)} · {fmtTime(now)}
      </span>
    </div>
  )
}

/** Sun/Moon toggle — mounted-guarded so SSR and first client render agree. */
function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useIsClient()
  const isDark = mounted && resolvedTheme === 'dark'

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-10"
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {isDark ? <Sun className="size-4.5" /> : <Moon className="size-4.5" />}
    </Button>
  )
}

/** Low-stock alerts — fetched ONCE on header mount from GET /api/dashboard. */
function NotificationsPopover() {
  const setView = useUiStore((s) => s.setView)
  const [lowStock, setLowStock] = useState<Product[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/dashboard', { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error(`GET /api/dashboard → ${res.status}`)
        return res.json() as Promise<DashboardData>
      })
      .then((data) => {
        if (!cancelled) setLowStock(Array.isArray(data?.lowStock) ? data.lowStock : [])
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const count = lowStock?.length ?? 0

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative size-10" aria-label={`Notifications${count > 0 ? ` — ${count} low-stock alerts` : ''}`}>
          <Bell className="size-4.5" />
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex size-4.5 min-w-4.5 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold leading-none text-white shadow-xs">
              {count > 9 ? '9+' : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Low stock alerts</p>
          {lowStock && count > 0 && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
              {count} item{count === 1 ? '' : 's'}
            </span>
          )}
        </div>
        <div className="max-h-72 overflow-y-auto p-1.5" style={{ scrollbarGutter: 'stable' }}>
          {lowStock === null && !failed && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Checking stock…</p>
          )}
          {failed && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Alerts unavailable right now.
            </p>
          )}
          {lowStock !== null && count === 0 && (
            <div className="flex flex-col items-center gap-2 px-3 py-6 text-center">
              <CheckCircle2 className="size-6 text-emerald-500" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">All stocked up — nothing below reorder level.</p>
            </div>
          )}
          {lowStock !== null &&
            lowStock.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setView('inventory')
                  setOpen(false)
                }}
                className="flex min-h-10 w-full items-center gap-3 rounded-md px-3 py-2 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <AlertTriangle className="size-4 shrink-0 text-amber-500" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{p.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{p.sku}</span>
                </span>
                <span className="shrink-0 text-xs font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                  {p.stock} left
                </span>
              </button>
            ))}
        </div>
        {lowStock !== null && count > 0 && (
          <div className="border-t px-4 py-2.5">
            <button
              type="button"
              onClick={() => {
                setView('inventory')
                setOpen(false)
              }}
              className="text-xs font-medium text-muted-foreground underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              Open Inventory →
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

export function AppHeader() {
  const setView = useUiStore((s) => s.setView)
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen)

  return (
    <header className="no-print sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 w-full items-center gap-1.5 px-3 sm:h-16 sm:gap-2 sm:px-5">
        {/* Mobile nav trigger */}
        <Button
          variant="ghost"
          size="icon"
          className="size-10 lg:hidden"
          aria-label="Open navigation menu"
          aria-controls="mobile-nav"
          onClick={() => setSidebarOpen(true)}
        >
          <Menu className="size-5" />
        </Button>

        {/* Brand */}
        <button
          type="button"
          onClick={() => setView('dashboard')}
          aria-label="Circuit Retail ERP — go to dashboard"
          className={cn(
            'flex min-h-10 items-center gap-2.5 rounded-md px-1 outline-none',
            'focus-visible:ring-2 focus-visible:ring-ring/50'
          )}
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
            <Store className="size-4" aria-hidden="true" />
          </span>
          <span className="text-base font-bold tracking-tight">Circuit</span>
          <span className="hidden text-sm font-medium text-muted-foreground sm:block">Retail ERP</span>
        </button>

        <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
          <LiveClock />

          <Button className="h-10 gap-1.5 px-3 sm:px-4" onClick={() => setView('pos')} aria-label="Start a new sale — open POS terminal">
            <Plus className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">New Sale</span>
            <span className="sm:hidden">Sale</span>
          </Button>

          <ThemeToggle />
          <NotificationsPopover />
        </div>
      </div>
    </header>
  )
}
