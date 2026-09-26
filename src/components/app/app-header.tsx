'use client'

// ── Sticky app header: brand, clock, quick actions, theme, alerts ────────────
import { useSyncExternalStore } from 'react'
import { useTheme } from 'next-themes'
import {
  CalendarDays,
  Menu,
  Moon,
  Plus,
  Search,
  Store,
  Sun,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useUiStore } from '@/store/ui'
import { openCommandPalette } from '@/components/app/command-palette'
import { NotificationBell } from '@/components/app/notification-bell'
import { fmtDate, fmtTime } from '@/lib/format'
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

          {/* Command palette trigger (Ctrl/⌘+K) */}
          <button
            type="button"
            onClick={openCommandPalette}
            aria-label="Search pages and actions (Ctrl+K)"
            className={cn(
              'hidden min-h-9 items-center gap-2 rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground outline-none transition-colors',
              'hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 md:flex lg:min-w-56'
            )}
          >
            <Search className="size-4 shrink-0" aria-hidden="true" />
            <span className="flex-1 text-left">Search…</span>
            <kbd className="kbd pointer-events-none hidden text-[10px] lg:inline-flex">Ctrl K</kbd>
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="size-10 md:hidden"
            aria-label="Search (Ctrl+K)"
            onClick={openCommandPalette}
          >
            <Search className="size-5" />
          </Button>

          <Button className="h-10 gap-1.5 px-3 sm:px-4" onClick={() => setView('pos')} aria-label="Start a new sale — open POS terminal">
            <Plus className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">New Sale</span>
            <span className="sm:hidden">Sale</span>
          </Button>

          <ThemeToggle />
          <NotificationBell />
        </div>
      </div>
    </header>
  )
}
