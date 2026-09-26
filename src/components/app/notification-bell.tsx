'use client'

// ── Header notification bell — live alert center (replaces the static bell) ──
// Polls GET /api/notifications (light endpoint) every 60s + refetch on open.
// Sections: Out of stock → Low stock → Shift open → Today (info) → Refunds.
// Badge counts actionable items only (Today row is informational, uncounted).
// Type is declared locally: /api/notifications' shape is NOT importable
// client-side from the route file in App Router client components.
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Bell,
  BellOff,
  Clock,
  PackageOpen,
  PackageX,
  RefreshCw,
  TrendingUp,
  Undo2,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { useApi } from '@/hooks/use-api'
import { useUiStore, type ViewKey } from '@/store/ui'
import { fmtMoneyInt, fmtTime } from '@/lib/format'
import { cn } from '@/lib/utils'

// ── Local mirror of GET /api/notifications' payload ──────────────────────────
interface LowStockItem {
  id: string
  name: string
  sku: string
  stock: number
  reorderLevel: number
  price: number
}
interface OutOfStockItem {
  id: string
  name: string
  sku: string
  price: number
}
interface NotificationsData {
  lowStock: LowStockItem[]
  outOfStock: OutOfStockItem[]
  openShift: { id: string; openedAt: string; openedBy: string | null } | null
  today: { sales: number; transactions: number; expenses: number }
  refundedToday: number
  generatedAt: string
}

type Tone = 'red' | 'amber' | 'emerald'

const TONE_CHIP: Record<Tone, string> = {
  red: 'bg-red-500/10 text-red-600 dark:text-red-400',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
}
const TONE_TEXT: Record<Tone, string> = {
  red: 'text-red-600 dark:text-red-400',
  amber: 'text-amber-600 dark:text-amber-400',
  emerald: 'text-emerald-600 dark:text-emerald-400',
}
const TONE_BADGE: Record<Tone, string> = {
  red: 'bg-red-500 text-white',
  amber: 'bg-amber-500 text-white',
  emerald: 'bg-emerald-500 text-white',
}

/** '2h 15m' / '45m' elapsed label for the open shift (clamped ≥ 0). */
function elapsedLabel(openedAt: string): string {
  const totalMin = Math.max(0, Math.floor((Date.now() - new Date(openedAt).getTime()) / 60_000))
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`
}

/** Small uppercase section header with a tinted icon chip (+ optional count). */
function SectionHeader({
  icon: Icon,
  tone,
  label,
  count,
}: {
  icon: LucideIcon
  tone: Tone
  label: string
  count?: number
}) {
  return (
    <div className="flex items-center gap-2 px-2 pb-1 pt-3 first:pt-1.5">
      <span className={cn('flex size-5 shrink-0 items-center justify-center rounded-md', TONE_CHIP[tone])}>
        <Icon className="size-3" aria-hidden="true" />
      </span>
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {typeof count === 'number' && (
        <span className="ml-auto text-[11px] font-semibold tabular-nums text-muted-foreground">
          {count}
        </span>
      )}
    </div>
  )
}

/** One tappable notification row — real button, truncated text, tabular trailing. */
function Row({
  label,
  sub,
  trailing,
  trailingCls,
  ariaLabel,
  onClick,
}: {
  label: string
  sub?: string
  trailing?: string
  trailingCls?: string
  ariaLabel: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        'flex min-h-10 w-full items-center gap-3 rounded-md px-2 py-1.5 text-left outline-none',
        'transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50'
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{label}</span>
        {sub && <span className="block truncate text-xs text-muted-foreground">{sub}</span>}
      </span>
      {trailing && (
        <span className={cn('shrink-0 whitespace-nowrap text-xs font-semibold tabular-nums', trailingCls)}>
          {trailing}
        </span>
      )}
    </button>
  )
}

export function NotificationBell() {
  const setView = useUiStore((s) => s.setView)
  const [open, setOpen] = useState(false)
  const { data, error, refetch } = useApi<NotificationsData>('/api/notifications', { pollMs: 60_000 })

  // Spinner state for the manual refresh button (poll refetches stay silent).
  // useApi's silent refetch can't expose in-flight state, so spin for a short
  // window that always covers this light endpoint's round-trip.
  const [spin, setSpin] = useState(false)
  const spinTimer = useRef<number | null>(null)

  const clearSpinTimer = useCallback(() => {
    if (spinTimer.current !== null) {
      window.clearTimeout(spinTimer.current)
      spinTimer.current = null
    }
  }, [])

  const refreshNow = useCallback(() => {
    clearSpinTimer()
    setSpin(true)
    refetch()
    spinTimer.current = window.setTimeout(() => setSpin(false), 900)
  }, [refetch, clearSpinTimer])

  // Unmount cleanup — timer only, no setState inside the effect body.
  useEffect(() => clearSpinTimer, [clearSpinTimer])

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next)
      if (next) refreshNow() // fresh data on every open
    },
    [refreshNow]
  )

  const go = useCallback(
    (view: ViewKey) => {
      setOpen(false)
      setView(view)
    },
    [setView]
  )

  const lowStock = data?.lowStock ?? []
  const outOfStock = data?.outOfStock ?? []
  const openShift = data?.openShift ?? null
  const refundedToday = data?.refundedToday ?? 0
  const today = data?.today

  // Badge counts actionable items only; the Today milestone row is info-only.
  const badgeCount = lowStock.length + outOfStock.length + (openShift ? 1 : 0) + (refundedToday > 0 ? 1 : 0)
  const tone: Tone = outOfStock.length > 0 ? 'red' : lowStock.length > 0 ? 'amber' : 'emerald'
  const todayActive = !!today && (today.transactions > 0 || today.sales !== 0 || today.expenses !== 0)
  const caughtUp = data !== null && badgeCount === 0

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-10"
          aria-label={`Notifications${badgeCount > 0 ? ` — ${badgeCount} active alert${badgeCount === 1 ? '' : 's'}` : ''}`}
        >
          <Bell className="size-4.5" />
          {badgeCount > 0 && (
            <span
              className={cn(
                'absolute -right-0.5 -top-0.5 flex size-4.5 min-w-4.5 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none shadow-xs',
                TONE_BADGE[tone]
              )}
            >
              {badgeCount > 9 ? '9+' : badgeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[340px] max-w-[calc(100vw-1rem)] p-0">
        {/* Title bar */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          {badgeCount > 0 && (
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[11px] font-semibold text-white',
                TONE_BADGE[tone]
              )}
            >
              {badgeCount} alert{badgeCount === 1 ? '' : 's'}
            </span>
          )}
        </div>

        {/* Scrollable body */}
        <div className="max-h-[70vh] overflow-y-auto p-1.5" style={{ scrollbarGutter: 'stable' }}>
          {/* Loading skeleton */}
          {data === null && !error && (
            <div className="space-y-1 px-1 py-2" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 px-2 py-2">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                  <Skeleton className="h-3 w-16" />
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex flex-col items-center gap-2 px-3 py-6 text-center">
              <BellOff className="size-6 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">Couldn&apos;t load notifications.</p>
              <p className="text-xs text-muted-foreground">Use the refresh button below to try again.</p>
            </div>
          )}

          {/* Empty state — zero actionable items */}
          {caughtUp && (
            <div className="flex flex-col items-center gap-2 px-3 py-6 text-center">
              <span className="flex size-10 items-center justify-center rounded-full bg-emerald-500/10">
                <BellOff className="size-5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              </span>
              <p className="text-sm font-medium">You&apos;re all caught up</p>
              <p className="text-xs text-muted-foreground">No stock, shift or refund alerts right now.</p>
            </div>
          )}

          {/* Out of stock */}
          {outOfStock.length > 0 && (
            <section aria-label="Out of stock">
              <SectionHeader icon={PackageX} tone="red" label="Out of stock" count={outOfStock.length} />
              {outOfStock.map((p) => (
                <Row
                  key={p.id}
                  label={p.name}
                  sub={p.sku}
                  trailing="0 in stock"
                  trailingCls={TONE_TEXT.red}
                  ariaLabel={`Out of stock: ${p.name} — open Products`}
                  onClick={() => go('products')}
                />
              ))}
            </section>
          )}

          {/* Low stock */}
          {lowStock.length > 0 && (
            <section aria-label="Low stock">
              <SectionHeader icon={PackageOpen} tone="amber" label="Low stock" count={lowStock.length} />
              {lowStock.map((p) => (
                <Row
                  key={p.id}
                  label={p.name}
                  sub={p.sku}
                  trailing={`${p.stock} left · reorder at ${p.reorderLevel}`}
                  trailingCls={TONE_TEXT.amber}
                  ariaLabel={`Low stock: ${p.name}, ${p.stock} left, reorder at ${p.reorderLevel} — open Inventory`}
                  onClick={() => go('inventory')}
                />
              ))}
            </section>
          )}

          {/* Shift open */}
          {openShift && (
            <section aria-label="Shift">
              <SectionHeader icon={Clock} tone="emerald" label="Shift" />
              <Row
                label={`Shift open · ${elapsedLabel(openShift.openedAt)}`}
                sub={openShift.openedBy ? `by ${openShift.openedBy}` : undefined}
                ariaLabel={`Shift open for ${elapsedLabel(openShift.openedAt)}${openShift.openedBy ? `, by ${openShift.openedBy}` : ''} — open POS`}
                onClick={() => go('pos')}
              />
            </section>
          )}

          {/* Today milestone (info only — not counted in the badge) */}
          {todayActive && today && (
            <section aria-label="Today">
              <SectionHeader icon={TrendingUp} tone="emerald" label="Today" />
              <Row
                label={`${fmtMoneyInt(today.sales)} · ${today.transactions} sale${today.transactions === 1 ? '' : 's'} · ${fmtMoneyInt(today.expenses)} expenses today`}
                ariaLabel={`Today: ${fmtMoneyInt(today.sales)} from ${today.transactions} transaction${today.transactions === 1 ? '' : 's'} and ${fmtMoneyInt(today.expenses)} expenses — open Dashboard`}
                onClick={() => go('dashboard')}
              />
            </section>
          )}

          {/* Refunds today */}
          {refundedToday > 0 && (
            <section aria-label="Refunds">
              <SectionHeader icon={Undo2} tone="red" label="Refunds" />
              <Row
                label={`${refundedToday} refund${refundedToday === 1 ? '' : 's'} today`}
                ariaLabel={`${refundedToday} refund${refundedToday === 1 ? '' : 's'} today — open Sales`}
                onClick={() => go('sales')}
              />
            </section>
          )}
        </div>

        {/* Footer: last refresh + manual refresh */}
        <div className="flex items-center justify-between border-t px-4 py-2.5">
          <span className="text-xs tabular-nums text-muted-foreground">
            {data?.generatedAt
              ? `Refreshed ${fmtTime(data.generatedAt)}`
              : error
                ? 'Refresh failed'
                : 'Refreshing…'}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="Refresh notifications"
            title="Refresh now"
            onClick={refreshNow}
          >
            <RefreshCw className={cn('size-3.5', spin && 'animate-spin')} aria-hidden="true" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
