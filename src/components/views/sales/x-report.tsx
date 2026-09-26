'use client'

// ── X-Report (shift snapshot) — register read from a shift-start time ────────
// Data: GET /api/reports?type=xreport&from=YYYY-MM-DD&fromTime=HH:MM
// Shares the printable body with the Z-Report; accent is sky to distinguish.
import { useMemo, useState } from 'react'
import { Timer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/shared/page-bits'
import { useApi } from '@/hooks/use-api'
import { cn } from '@/lib/utils'
import { currencySymbol, dhakaDateKey, fmtMoney } from '@/lib/format'
import type { ZReport } from '@/lib/types'
import { ZReportBody } from './z-report'

function shiftKey(now: Date, fromMs: number): string {
  const d = new Date(now.getTime() - fromMs)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(Math.floor(d.getMinutes() / 5) * 5).padStart(2, '0')
  return `${hh}:${mm}`
}

export function XReportDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-4" aria-describedby={undefined}>
        {open && <XReportForm onOpenChange={onOpenChange} />}
      </DialogContent>
    </Dialog>
  )
}

function XReportForm({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const [date, setDate] = useState(() => dhakaDateKey(new Date()))
  // Default shift start: 9 AM Dhaka-ish guess; presets adjust it.
  const [fromTime, setFromTime] = useState('09:00')
  const [preset, setPreset] = useState<'morning' | 'evening' | 'last8h' | 'custom'>('morning')
  const symbol = currencySymbol()

  const presets = useMemo(
    () => [
      { id: 'morning' as const, label: 'Morning shift', time: '09:00' },
      { id: 'evening' as const, label: 'Evening shift', time: '17:00' },
      { id: 'last8h' as const, label: 'Last 8 hours', time: shiftKey(new Date(), 8 * 3600_000) },
    ],
    // recompute "last 8h" each time the dialog opens (component remounts on open)
    []
  )

  const applyPreset = (id: 'morning' | 'evening' | 'last8h') => {
    setPreset(id)
    const p = presets.find((x) => x.id === id)
    if (p) setFromTime(p.time)
  }

  const isToday = date === dhakaDateKey(new Date())
  const clampedTime =
    isToday && fromTime > shiftKey(new Date(), 0) ? shiftKey(new Date(), 0) : fromTime

  const url = `/api/reports?type=xreport&from=${encodeURIComponent(date)}&fromTime=${encodeURIComponent(clampedTime)}`
  const { data: report, loading, error } = useApi<ZReport>(url)

  const print = () => {
    document.body.classList.add('printing-zreport')
    window.print()
    setTimeout(() => document.body.classList.remove('printing-zreport'), 500)
  }

  const maxHourly = Math.max(1, ...(report?.hourly ?? []).map((h) => h.sales))

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-base">
          <span className="inline-flex size-6 items-center justify-center rounded-md bg-sky-500/15 text-sky-600 dark:text-sky-400">
            <Timer className="size-3.5" aria-hidden />
          </span>
          X-Report — shift snapshot
        </DialogTitle>
        <DialogDescription className="text-xs">
          Read the register mid-shift without closing the day ({symbol === '৳' ? 'Asia/Dhaka' : 'store-local'} time). The
          Z-Report still covers the full day.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1.5" role="group" aria-label="Shift presets">
          {presets.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => applyPreset(p.id)}
              className={cn(
                'h-8 rounded-full border px-3 text-xs font-semibold transition-colors',
                preset === p.id
                  ? 'border-sky-500/60 bg-sky-500/10 text-sky-700 dark:text-sky-400'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <Input
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value)
            setPreset('custom')
          }}
          aria-label="X-report date"
          className="h-9 w-[8.5rem] text-xs"
        />
        <Input
          type="time"
          value={fromTime}
          step={300}
          onChange={(e) => {
            setFromTime(e.target.value)
            setPreset('custom')
          }}
          aria-label="Shift start time"
          className="h-9 w-28 text-xs"
        />
        {loading && <Spinner className="size-4 text-muted-foreground" />}
      </div>

      {error ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : loading && !report ? (
        <div className="flex items-center justify-center py-10">
          <Spinner className="size-5 text-muted-foreground" />
        </div>
      ) : report ? (
        <div className="-mr-2 max-h-[55vh] overflow-y-auto pr-2">
          <ZReportBody report={report} maxHourly={maxHourly} symbol={symbol} />
        </div>
      ) : null}

      <DialogFooter className="gap-2 sm:gap-2">
        <Button variant="outline" className="h-10" onClick={() => onOpenChange(false)}>
          Close
        </Button>
        <Button className="h-10" disabled={!report || loading} onClick={print}>
          <Timer className="size-4" /> Print X-report
        </Button>
      </DialogFooter>

      {/* Hidden print clone — shares the z-report print CSS */}
      {report && (
        <div className="zreport-print-area" style={{ display: 'none' }} aria-hidden>
          <ZReportBody report={report} maxHourly={maxHourly} symbol={symbol} printHeader />
        </div>
      )}
    </>
  )
}
