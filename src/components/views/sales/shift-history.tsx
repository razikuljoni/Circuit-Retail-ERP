'use client'

// ── Shift history — closed cashier shifts + reprintable close snapshots ──────
// Data: GET /api/shifts?limit=20 (newest first). totalsJson arrives as the RAW
// string stored on Shift.totalsJson and is parsed defensively here (try/catch
// + shape check) into ShiftSnapshot — legacy shifts closed before snapshots
// were persisted carry null and honestly show "No snapshot" (reprint disabled).
// Reprint renders the persisted snapshot in the same report layout as the POS
// close dialog and prints via the shared body.printing-shift clone pattern
// (globals.css) — same report shape, so no extra print CSS is needed.
import { useState } from 'react'
import {
  Banknote,
  CalendarClock,
  History,
  Printer,
  User,
  Wallet,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/shared/page-bits'
import { useApi } from '@/hooks/use-api'
import { cn } from '@/lib/utils'
import { fmtDate, fmtDateTime, fmtMoney, fmtNum, fmtTime } from '@/lib/format'
import type { Shift, ShiftSnapshot } from '@/lib/types'

interface ShiftsResponse {
  shifts: Shift[]
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/** '+৳50.00 over' / '−৳50.00 short' / '৳0.00 — exact' (matches close dialog). */
function variancePhrase(v: number): string {
  if (v > 0) return `+${fmtMoney(v)} over`
  if (v < 0) return `−${fmtMoney(Math.abs(v))} short`
  return `${fmtMoney(0)} — exact`
}

/** '2h 05m' style duration from milliseconds (floored to the minute). */
function fmtDuration(ms: number): string {
  const mins = Math.max(0, Math.floor(ms / 60_000))
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`
}

const TOTAL_KEYS = [
  'transactions',
  'grossSales',
  'refunds',
  'netSales',
  'cashSales',
  'cardSales',
  'mobileSales',
  'expectedDrawer',
] as const
type TotalKey = (typeof TOTAL_KEYS)[number]

/** Defensive Shift.totalsJson → ShiftSnapshot. Any malformed/legacy value → null. */
function parseSnapshot(raw: string | null | undefined): ShiftSnapshot | null {
  if (!raw) return null
  let p: unknown
  try {
    p = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof p !== 'object' || p === null) return null
  const o = p as Record<string, unknown>
  const t = (typeof o.totals === 'object' && o.totals !== null ? o.totals : null) as Record<
    string,
    unknown
  > | null
  if (!t) return null
  const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
  for (const k of TOTAL_KEYS) if (!num(t[k])) return null
  if (!num(o.expensesPaid) || !num(o.variance) || typeof o.closedAt !== 'string') return null
  const totals = {} as Record<TotalKey, number>
  for (const k of TOTAL_KEYS) totals[k] = t[k] as number
  return { totals, expensesPaid: o.expensesPaid, variance: o.variance, closedAt: o.closedAt }
}

export function ShiftHistoryDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [selected, setSelected] = useState<{ shift: Shift; snapshot: ShiftSnapshot } | null>(null)

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!o) setSelected(null)
          onOpenChange(o)
        }}
      >
        <DialogContent className="max-w-2xl gap-4" aria-describedby={undefined}>
          {open && <ShiftHistoryBody onReprint={(shift, snapshot) => setSelected({ shift, snapshot })} />}
        </DialogContent>
      </Dialog>

      {/* Reprint dialog — stacked above the history list */}
      <Dialog open={selected !== null} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg gap-4">
          {selected && <ShiftReprint shift={selected.shift} snapshot={selected.snapshot} onDone={() => setSelected(null)} />}
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── History list ──────────────────────────────────────────────────────────────

function ShiftHistoryBody({
  onReprint,
}: {
  onReprint: (shift: Shift, snapshot: ShiftSnapshot) => void
}) {
  const { data, loading, error, refetch } = useApi<ShiftsResponse>('/api/shifts?limit=20')
  const shifts = data?.shifts ?? []

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-base">
          <span className="inline-flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
            <History className="size-3.5" aria-hidden />
          </span>
          Shift history
        </DialogTitle>
        <DialogDescription className="text-xs">
          Closed cashier shifts with their persisted close-time cash snapshot. Open a report to
          review or reprint it.
        </DialogDescription>
      </DialogHeader>

      {error ? (
        <ErrorState message={error} onRetry={() => void refetch()} />
      ) : loading && !data ? (
        <div className="space-y-2" aria-label="Loading shift history">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[5.5rem] w-full rounded-lg" />
          ))}
        </div>
      ) : shifts.length === 0 ? (
        <EmptyState
          icon={History}
          title="No shifts yet"
          message="Open a shift from the POS screen to start tracking the drawer — every close is archived here."
        />
      ) : (
        <ul className="-mr-2 max-h-96 space-y-2 overflow-y-auto pr-2" aria-label="Shift history list">
          {shifts.map((s) => (
            <ShiftRow key={s.id} shift={s} onReprint={onReprint} />
          ))}
        </ul>
      )}

      {!error && !loading && shifts.length > 0 && (
        <p className="text-center text-[11px] text-muted-foreground">
          Newest first · showing last {fmtNum(shifts.length)} shift{shifts.length === 1 ? '' : 's'}
        </p>
      )}
    </>
  )
}

function ShiftRow({
  shift: s,
  onReprint,
}: {
  shift: Shift
  onReprint: (shift: Shift, snapshot: ShiftSnapshot) => void
}) {
  const snapshot = parseSnapshot(s.totalsJson)
  const isOpen = !s.closedAt
  const duration = fmtDuration(new Date(s.closedAt ?? Date.now()).getTime() - new Date(s.openedAt).getTime())

  return (
    <li className="rounded-lg border p-3 transition-colors hover:bg-accent/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex min-w-0 items-center gap-1.5 text-sm font-semibold">
            <CalendarClock className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="truncate">{fmtDateTime(s.openedAt)}</span>
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {isOpen ? (
              <>Open · {duration} so far</>
            ) : (
              <>
                Closed {fmtDateTime(s.closedAt ?? '')} · {duration}
              </>
            )}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {isOpen ? (
            <>
              <Badge
                variant="outline"
                className="border-emerald-500/40 bg-emerald-500/10 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400"
                title="This shift is still open"
              >
                open
              </Badge>
              <span className="text-[11px] text-muted-foreground">In progress</span>
            </>
          ) : snapshot ? (
            <>
              <VarianceBadge variance={snapshot.variance} />
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 px-2.5 text-xs"
                onClick={() => onReprint(s, snapshot)}
                aria-label={`View close report for the shift opened ${fmtDateTime(s.openedAt)}`}
              >
                <Printer className="size-3.5" aria-hidden /> View report
              </Button>
            </>
          ) : (
            <>
              <Badge variant="outline" className="text-[11px] text-muted-foreground" title="No close snapshot available">
                —
              </Badge>
              <span className="text-[11px] text-muted-foreground" title="Closed before snapshots were persisted">
                No snapshot
              </span>
            </>
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="inline-flex items-center gap-1 text-muted-foreground" title="Cashier">
          <User className="size-3" aria-hidden />
          <span className={cn(!s.openedBy && 'italic')}>{s.openedBy || '—'}</span>
        </span>
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Wallet className="size-3" aria-hidden /> Float{' '}
          <span className="font-semibold tabular-nums text-foreground">{fmtMoney(s.openingFloat)}</span>
        </span>
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Banknote className="size-3" aria-hidden /> Counted{' '}
          <span className="font-semibold tabular-nums text-foreground">
            {s.countedCash === null ? '—' : fmtMoney(s.countedCash)}
          </span>
        </span>
      </div>

      {s.note && (
        <p className="mt-1.5 truncate text-xs text-muted-foreground" title={s.note}>
          {s.note}
        </p>
      )}
    </li>
  )
}

function VarianceBadge({ variance }: { variance: number }) {
  if (variance > 0) {
    return (
      <Badge
        variant="outline"
        className="border-emerald-500/40 bg-emerald-500/10 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400"
        title="Counted cash exceeded the expected drawer"
      >
        +{fmtMoney(variance)} over
      </Badge>
    )
  }
  if (variance < 0) {
    return (
      <Badge
        variant="outline"
        className="border-red-500/40 bg-red-500/10 text-[11px] font-semibold text-red-600 dark:text-red-400"
        title="Counted cash was short of the expected drawer"
      >
        −{fmtMoney(Math.abs(variance))} short
      </Badge>
    )
  }
  return (
    <Badge
      variant="outline"
      className="text-[11px] text-muted-foreground"
      title="Counted cash matched the expected drawer exactly"
    >
      exact
    </Badge>
  )
}

// ── Reprint dialog (persisted snapshot → close-report layout) ────────────────

function ShiftReprint({
  shift,
  snapshot,
  onDone,
}: {
  shift: Shift
  snapshot: ShiftSnapshot
  onDone: () => void
}) {
  const closedAt = snapshot.closedAt || shift.closedAt || ''

  // Focused print: tag <body> so only the hidden clone hits paper (shares the
  // shift-close report's printing-shift CSS — same report layout).
  const print = () => {
    document.body.classList.add('printing-shift')
    window.print()
    setTimeout(() => document.body.classList.remove('printing-shift'), 500)
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-base">
          <span className="inline-flex size-6 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <Printer className="size-3.5" aria-hidden />
          </span>
          Shift report — reprint
        </DialogTitle>
        <DialogDescription className="text-xs">
          Persisted close-time snapshot · opened {fmtDateTime(shift.openedAt)}
          {shift.openedBy ? ` · ${shift.openedBy}` : ''}
        </DialogDescription>
      </DialogHeader>

      {/* Variance highlight — same banner as the close dialog's done phase */}
      <div
        className={cn(
          'flex items-center justify-between gap-3 rounded-lg border p-3',
          snapshot.variance > 0 && 'border-emerald-500/40 bg-emerald-500/5',
          snapshot.variance < 0 && 'border-red-500/40 bg-red-500/5',
          snapshot.variance === 0 && 'bg-muted/40'
        )}
      >
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Variance
          </p>
          <p
            className={cn(
              'text-lg font-bold tabular-nums',
              snapshot.variance > 0 && 'text-emerald-600 dark:text-emerald-400',
              snapshot.variance < 0 && 'text-red-600 dark:text-red-400',
              snapshot.variance === 0 && 'text-foreground'
            )}
          >
            {variancePhrase(snapshot.variance)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Counted {fmtMoney(shift.countedCash ?? 0)} · Expected{' '}
            {fmtMoney(snapshot.totals.expectedDrawer)} · Closed {fmtTime(closedAt)}
          </p>
        </div>
      </div>

      <div className="-mr-2 max-h-[42vh] overflow-y-auto pr-2">
        <SnapshotSummary
          totals={snapshot.totals}
          expensesPaid={snapshot.expensesPaid}
          openingFloat={shift.openingFloat}
          meta={
            <>
              Closed {fmtDate(closedAt)} {fmtTime(closedAt)}
            </>
          }
        />
      </div>

      <DialogFooter className="gap-2 sm:gap-2">
        <Button variant="outline" className="h-10 flex-1" onClick={onDone}>
          Close
        </Button>
        <Button className="h-10 flex-1" onClick={print}>
          <Printer className="size-4" aria-hidden /> Print
        </Button>
      </DialogFooter>

      {/* Hidden print clone — display:none on screen, only clone on paper */}
      <div className="shift-print-area" style={{ display: 'none' }} aria-hidden>
        <ShiftReportPaper shift={shift} snapshot={snapshot} />
      </div>
    </>
  )
}

// ── Local summary grid (mirrors the close dialog's ShiftSummary style) ────────

function Stat({
  label,
  value,
  strong = false,
  tone,
}: {
  label: string
  value: string
  strong?: boolean
  tone?: 'good' | 'bad'
}) {
  return (
    <div className="rounded-lg border px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-0.5 tabular-nums',
          strong ? 'text-base font-bold' : 'text-sm font-semibold',
          tone === 'good' && 'text-emerald-600 dark:text-emerald-400',
          tone === 'bad' && 'text-red-600 dark:text-red-400'
        )}
      >
        {value}
      </p>
    </div>
  )
}

function Row({
  label,
  value,
  tone,
}: {
  label: React.ReactNode
  value: React.ReactNode
  tone?: 'good' | 'bad' | 'warn'
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="min-w-0 text-muted-foreground">{label}</span>
      <span
        className={cn(
          'shrink-0 font-semibold tabular-nums',
          tone === 'good' && 'text-emerald-600 dark:text-emerald-400',
          tone === 'bad' && 'text-red-600 dark:text-red-400',
          tone === 'warn' && 'text-amber-600 dark:text-amber-400'
        )}
      >
        {value}
      </span>
    </div>
  )
}

function SnapshotSummary({
  totals,
  expensesPaid,
  openingFloat,
  meta,
}: {
  totals: ShiftSnapshot['totals']
  expensesPaid: number
  openingFloat: number
  meta?: React.ReactNode
}) {
  // Cash refunds are already netted inside expectedDrawer — derive them so the
  // drawer block visibly adds up (opening + cash sales − cash refunds).
  const cashRefunds = Math.max(0, r2(openingFloat + totals.cashSales - totals.expectedDrawer))

  return (
    <div className="space-y-3">
      {meta && <p className="text-[11px] text-muted-foreground">{meta}</p>}

      {/* Headline stats */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Transactions" value={fmtNum(totals.transactions)} />
        <Stat label="Gross sales" value={fmtMoney(totals.grossSales)} />
        <Stat label="Refunds" value={fmtMoney(totals.refunds)} tone={totals.refunds > 0 ? 'bad' : undefined} />
        <Stat label="Net sales" value={fmtMoney(totals.netSales)} strong />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {/* Payment breakdown */}
        <div className="rounded-lg border p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Payments received
          </p>
          <div className="space-y-1.5">
            <Row label="Cash" value={fmtMoney(totals.cashSales)} />
            <Row label="Card" value={fmtMoney(totals.cardSales)} />
            <Row label="Mobile" value={fmtMoney(totals.mobileSales)} />
          </div>
        </div>

        {/* Drawer reconciliation */}
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
            Cash drawer
          </p>
          <div className="space-y-1.5">
            <Row label="Opening float" value={`+${fmtMoney(openingFloat)}`} />
            <Row label="Cash sales" value={`+${fmtMoney(totals.cashSales)}`} />
            <Row label="Cash refunds" value={`−${fmtMoney(cashRefunds)}`} tone={cashRefunds > 0 ? 'bad' : undefined} />
            <Row label="Cash expenses" value={`−${fmtMoney(expensesPaid)}`} tone={expensesPaid > 0 ? 'warn' : undefined} />
            <div className="flex items-center justify-between gap-2 border-t border-emerald-500/30 pt-2">
              <span className="text-sm font-semibold">Expected in drawer</span>
              <span className="text-base font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                {fmtMoney(totals.expectedDrawer)}
              </span>
            </div>
          </div>
          <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground">
            Cash expenses are tracked but not deducted from the expected drawer.
          </p>
        </div>
      </div>
    </div>
  )
}

/** Print-only sheet for the reprinted close report (rendered inside .shift-print-area). */
function ShiftReportPaper({ shift, snapshot }: { shift: Shift; snapshot: ShiftSnapshot }) {
  const closedAt = snapshot.closedAt || shift.closedAt || ''
  return (
    <div className="space-y-3">
      <div className="border-b pb-2">
        <p className="text-sm font-bold">Shift Report · Cash Close</p>
        <p className="text-xs">
          Opened {fmtDate(shift.openedAt)} {fmtTime(shift.openedAt)}
          {shift.openedBy ? ` · ${shift.openedBy}` : ''} — closed {fmtDate(closedAt)} {fmtTime(closedAt)} ·
          reprint
        </p>
      </div>

      <SnapshotSummary totals={snapshot.totals} expensesPaid={snapshot.expensesPaid} openingFloat={shift.openingFloat} />

      <div className="space-y-1 rounded-lg border p-3">
        <div className="flex items-center justify-between text-sm">
          <span>Counted cash</span>
          <span className="font-bold tabular-nums">{fmtMoney(shift.countedCash ?? 0)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span>Expected in drawer</span>
          <span className="font-semibold tabular-nums">{fmtMoney(snapshot.totals.expectedDrawer)}</span>
        </div>
        <div className="flex items-center justify-between border-t pt-1.5 text-base">
          <span className="font-bold">Variance</span>
          <span className="font-bold tabular-nums">{variancePhrase(snapshot.variance)}</span>
        </div>
      </div>

      {shift.note && <p className="border-t pt-2 text-xs">Note: {shift.note}</p>}
      <p className="text-center text-[10px]">Printed from Circuit Retail ERP</p>
    </div>
  )
}
