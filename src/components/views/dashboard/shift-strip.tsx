'use client'

// ── Dashboard shift strip — live "shift open" status card ────────────────────
// Polls /api/shifts/current every 30s. Renders NOTHING when no shift is open
// or the payload hasn't loaded yet (header keeps its size — no empty card
// clutter). While a shift is open: pulsing emerald dot + elapsed (30s tick,
// hydration-safe — same pattern as pos/shift-bar.tsx), cashier, live shift
// totals and a jump to the POS. End-shift stays in the POS header on purpose.
import { useEffect, useState } from 'react'
import { ArrowRight, Banknote, ReceiptText, TrendingUp, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useApi } from '@/hooks/use-api'
import { fmtMoney } from '@/lib/format'
import type { ShiftCurrent } from '@/lib/types'

/** '2h 05m' style elapsed from milliseconds (floored to the minute). */
function fmtElapsed(ms: number): string {
  const mins = Math.max(0, Math.floor(ms / 60_000))
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`
}

export function ShiftStrip() {
  const { data } = useApi<ShiftCurrent>('/api/shifts/current', { pollMs: 30_000 })

  // Elapsed clock ticks every 30s. Hydration-safe: SSR/first paint renders no
  // card (data is null until the fetch resolves) and the timestamp only updates
  // from the interval — never synchronously inside the effect body.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  // Not loaded yet, or no shift open → render nothing.
  if (!data?.shift) return null

  const { shift, totals } = data

  const stats = [
    {
      label: 'Transactions',
      value: totals.transactions.toLocaleString(),
      title: 'Sales rung up during this shift',
    },
    {
      label: 'Net sales',
      value: fmtMoney(totals.netSales),
      title: 'Gross sales − refunds during this shift',
    },
    {
      label: 'Cash',
      value: fmtMoney(totals.cashSales),
      title: 'Cash payments collected this shift',
    },
    {
      label: 'Expected drawer',
      value: fmtMoney(totals.expectedDrawer),
      title: 'Opening float + cash sales − cash refunds',
      icon: Wallet,
    },
  ]

  return (
    <Card
      role="region"
      aria-label="Current cashier shift"
      className="relative gap-0 overflow-hidden border-emerald-500/30 bg-emerald-500/5 py-0 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300 dark:border-emerald-500/25 dark:bg-emerald-500/[0.08]"
    >
      <span className="absolute inset-y-0 left-0 w-1 bg-emerald-500/80" aria-hidden />
      <CardContent className="flex flex-col gap-3 p-4 pl-6 md:flex-row md:items-center md:gap-6">
        {/* Status: pulse dot + elapsed + cashier */}
        <div className="flex items-center gap-2.5">
          <span className="relative flex size-2.5 shrink-0" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
            <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
          </span>
          <div className="min-w-0">
            <p
              className="text-sm font-semibold whitespace-nowrap tabular-nums"
              title={`Opened ${new Date(shift.openedAt).toLocaleTimeString()}`}
            >
              Shift open
              <span className="font-normal text-muted-foreground">
                {' · '}
                {fmtElapsed(now - new Date(shift.openedAt).getTime())}
              </span>
            </p>
            {shift.openedBy && (
              <p className="truncate text-xs text-muted-foreground">Cashier: {shift.openedBy}</p>
            )}
          </div>
        </div>

        {/* Live shift totals — 2×2 on mobile, inline row from sm up */}
        <dl
          className="grid grid-cols-2 gap-x-6 gap-y-2 sm:flex sm:flex-1 sm:items-center sm:justify-end sm:gap-x-6"
          aria-label="Shift sales totals"
        >
          {stats.map(({ label, value, title, icon: Icon }) => (
            <div key={label} className="min-w-0" title={title}>
              <dt className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                {label}
              </dt>
              <dd className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold tabular-nums">
                {Icon && <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />}
                <span className="truncate">{value}</span>
              </dd>
            </div>
          ))}
        </dl>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            className="h-9"
            onClick={() => {
              window.location.hash = '#/pos'
            }}
            aria-label="Open POS terminal"
          >
            Open POS <ArrowRight className="size-3.5" aria-hidden />
          </Button>
          <p className="hidden text-[11px] leading-tight text-muted-foreground xl:block">
            End shift from the POS header
            <br />
            to count the drawer.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
