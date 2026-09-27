'use client'

// ── Shift bar — POS header chip for the cashier shift lifecycle ──────────────
// Polls /api/shifts/current every 30s. No active shift → outline "Start shift"
// button; active shift → compact chip: emerald pulse dot + "Shift open · 2h 15m"
// (elapsed ticks every 30s) + expected drawer total + "End shift" button.
import { useEffect, useState } from 'react'
import { Play, Square, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useApi } from '@/hooks/use-api'
import { cn } from '@/lib/utils'
import { fmtMoney } from '@/lib/format'
import type { ShiftCurrent } from '@/lib/types'
import { ShiftOpenDialog } from './shift-open-dialog'
import { ShiftCloseDialog } from './shift-close-dialog'

/** '2h 05m' style elapsed from milliseconds (floored to the minute). */
function fmtElapsed(ms: number): string {
  const mins = Math.max(0, Math.floor(ms / 60_000))
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`
}

export function ShiftBar({ className }: { className?: string }) {
  const { data, refetch } = useApi<ShiftCurrent>('/api/shifts/current', { pollMs: 30_000 })
  const [openOpen, setOpenOpen] = useState(false)
  const [closeOpen, setCloseOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  // Elapsed clock ticks every 30s. Hydration-safe: SSR/first paint renders no
  // chip (data is null until the fetch resolves), and the timestamp only
  // updates from the interval — never synchronously inside the effect body.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  // First load or hard failure → render nothing (header keeps its size).
  if (!data) return null

  const shift = data.shift

  return (
    <div className={cn('flex min-w-0 items-center', className)}>
      {shift ? (
        <div
          className="flex min-w-0 max-w-full items-center gap-2 rounded-full border bg-card py-1 pl-2.5 pr-1 shadow-xs transition-shadow hover:shadow-sm"
          title="Current cashier shift — click End shift to count the drawer"
        >
          <span className="relative flex size-2 shrink-0" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          <span className="min-w-0 truncate text-xs font-semibold whitespace-nowrap" title={`Opened ${new Date(shift.openedAt).toLocaleTimeString()}`}>
            Shift open
            <span className="text-muted-foreground">
              {' · '}
              {fmtElapsed(now - new Date(shift.openedAt).getTime())}
            </span>
          </span>
          <span
            className="inline-flex shrink-0 items-center gap-1 text-xs whitespace-nowrap text-muted-foreground"
            title="Expected drawer: opening float + cash sales − cash refunds"
          >
            <Wallet className="size-3.5 shrink-0" aria-hidden />
            <span className="font-semibold tabular-nums text-foreground">
              {fmtMoney(data.totals.expectedDrawer)}
            </span>
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 shrink-0 gap-1.5 rounded-full px-2.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              void refetch() // freshest totals before the close dialog reads them
              setCloseOpen(true)
            }}
            aria-label="End current shift"
          >
            <Square className="size-3" aria-hidden /> End shift
          </Button>
        </div>
      ) : (
        <Button variant="outline" className="h-10 shrink-0" onClick={() => setOpenOpen(true)}>
          <Play className="size-4" aria-hidden /> Start shift
        </Button>
      )}

      <ShiftOpenDialog open={openOpen} onOpenChange={setOpenOpen} onOpened={() => void refetch()} />
      <ShiftCloseDialog
        open={closeOpen}
        onOpenChange={setCloseOpen}
        current={data}
        onClosed={() => void refetch()}
      />
    </div>
  )
}
