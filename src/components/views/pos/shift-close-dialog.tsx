'use client'

// ── Close-shift dialog — live summary, counted cash, variance, print ─────────
// Form phase: compact definition grid fed by the live /api/shifts/current data
// (passed down from ShiftBar's poll), counted-cash input with a live variance
// preview. Done phase: final variance + a Print button that prints just the
// summary region via the body-class + .shift-print-area clone pattern.
import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Loader2, Printer, Square } from 'lucide-react'
import { toast } from 'sonner'
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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/shared/page-bits'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { fmtDate, fmtMoney, fmtNum, fmtTime } from '@/lib/format'
import type { ShiftCloseResult, ShiftCurrent } from '@/lib/types'

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

function variancePhrase(v: number): string {
  if (v > 0) return `+${fmtMoney(v)} over`
  if (v < 0) return `${fmtMoney(v)} short`
  return `${fmtMoney(0)} — exact`
}

export function ShiftCloseDialog({
  open,
  onOpenChange,
  current,
  onClosed,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  current: ShiftCurrent | null
  onClosed: (result: ShiftCloseResult) => void
}) {
  const [counted, setCounted] = useState('')
  const [note, setNote] = useState('')
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<ShiftCloseResult | null>(null)

  // Fresh form every time the dialog opens
  useEffect(() => {
    if (open) {
      setCounted('')
      setNote('')
      setResult(null)
      setPending(false)
    }
  }, [open])

  const shift = result?.shift ?? current?.shift ?? null
  const totals = result?.totals ?? current?.totals ?? null
  const expensesPaid = result?.expensesPaid ?? current?.expensesPaid ?? 0

  const countedNum = counted.trim() === '' ? null : Number(counted)
  const countedValid = countedNum !== null && Number.isFinite(countedNum) && countedNum >= 0

  // Live variance preview while typing
  const preview = useMemo(() => {
    if (!totals || countedNum === null || !Number.isFinite(countedNum)) return null
    return r2(countedNum - totals.expectedDrawer)
  }, [countedNum, totals])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!shift || !totals) return
    if (!countedValid || countedNum === null) {
      toast.error('Counted cash is required — enter the amount actually in the drawer (≥ 0)')
      return
    }
    setPending(true)
    try {
      const res = await api.post<ShiftCloseResult>(`/api/shifts/${shift.id}/close`, {
        countedCash: countedNum,
        note: note.trim() || undefined,
      })
      setResult(res)
      onClosed(res) // bar refetches → header returns to "Start shift"
      toast.success('Shift closed', {
        description: `Variance: ${variancePhrase(res.variance)}`,
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to close shift')
    } finally {
      setPending(false)
    }
  }

  // Focused print: tag <body> so only the hidden clone hits paper.
  const print = () => {
    document.body.classList.add('printing-shift')
    window.print()
    setTimeout(() => document.body.classList.remove('printing-shift'), 500)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <span
              className={cn(
                'inline-flex size-6 items-center justify-center rounded-md',
                result ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
              )}
            >
              {result ? <CheckCircle2 className="size-3.5" aria-hidden /> : <Square className="size-3.5" aria-hidden />}
            </span>
            {result ? 'Shift closed' : 'End shift — count the drawer'}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {result
              ? 'Shift summary saved. Print it for the cash-office records.'
              : 'Totals below are live since the shift opened. Count the physical cash and enter it to compute the variance.'}
          </DialogDescription>
        </DialogHeader>

        {!shift || !totals ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            {open ? <Spinner className="size-4" /> : null}
            {current ? 'No open shift.' : 'Loading shift…'}
          </div>
        ) : result ? (
          <>
            {/* Done phase — final variance + summary */}
            <div
              className={cn(
                'flex items-center justify-between gap-3 rounded-lg border p-3',
                result.variance > 0 && 'border-emerald-500/40 bg-emerald-500/5',
                result.variance < 0 && 'border-red-500/40 bg-red-500/5',
                result.variance === 0 && 'bg-muted/40'
              )}
            >
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Variance</p>
                <p
                  className={cn(
                    'text-lg font-bold tabular-nums',
                    result.variance > 0 && 'text-emerald-600 dark:text-emerald-400',
                    result.variance < 0 && 'text-red-600 dark:text-red-400',
                    result.variance === 0 && 'text-foreground'
                  )}
                >
                  {variancePhrase(result.variance)}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Counted {fmtMoney(result.shift.countedCash ?? 0)} · Expected {fmtMoney(result.totals.expectedDrawer)}
                </p>
              </div>
              <CheckCircle2
                className={cn('size-8 shrink-0', result.variance < 0 ? 'text-red-500/70' : 'text-emerald-500/70')}
                aria-hidden
              />
            </div>
            <div className="-mr-2 max-h-[45vh] overflow-y-auto pr-2">
              <ShiftSummary
                totals={result.totals}
                expensesPaid={result.expensesPaid}
                openingFloat={result.shift.openingFloat}
                meta={
                  <>
                    Opened {fmtDate(result.shift.openedAt)} {fmtTime(result.shift.openedAt)}
                    {result.shift.openedBy ? ` · ${result.shift.openedBy}` : ''} — closed {fmtTime(result.shift.closedAt ?? '')}
                  </>
                }
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" className="h-10 flex-1" onClick={print}>
                <Printer className="size-4" aria-hidden /> Print
              </Button>
              <Button className="h-10 flex-1" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>

            {/* Hidden print clone — display:none on screen, only clone on paper */}
            <div className="shift-print-area" style={{ display: 'none' }} aria-hidden>
              <ShiftClosePaper result={result} />
            </div>
          </>
        ) : (
          <>
            {/* Form phase — live summary + counted cash + variance preview */}
            <div className="-mr-2 max-h-[42vh] overflow-y-auto pr-2">
              <ShiftSummary
                totals={totals}
                expensesPaid={expensesPaid}
                openingFloat={shift.openingFloat}
                meta={
                  <>
                    Opened {fmtDate(shift.openedAt)} {fmtTime(shift.openedAt)}
                    {shift.openedBy ? ` · ${shift.openedBy}` : ''}
                  </>
                }
              />
            </div>

            <form id="shift-close-form" onSubmit={submit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="shift-counted-cash">Counted cash in drawer</Label>
                <Input
                  id="shift-counted-cash"
                  type="number"
                  min={0}
                  step={0.01}
                  inputMode="decimal"
                  value={counted}
                  onChange={(e) => setCounted(e.target.value)}
                  placeholder="0.00"
                  className="h-10 tabular-nums"
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Expected in drawer: <span className="font-semibold tabular-nums text-foreground">{fmtMoney(totals.expectedDrawer)}</span>
                </p>
              </div>
              <div aria-live="polite">
                {preview === null ? (
                  <p className="text-xs text-muted-foreground">Enter the counted amount to preview the variance.</p>
                ) : (
                  <p
                    className={cn(
                      'text-xs font-semibold tabular-nums',
                      preview > 0 && 'text-emerald-600 dark:text-emerald-400',
                      preview < 0 && 'text-red-600 dark:text-red-400',
                      preview === 0 && 'text-muted-foreground'
                    )}
                  >
                    Variance: {variancePhrase(preview)}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="shift-close-note">Close note (optional)</Label>
                <Textarea
                  id="shift-close-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Discrepancy explanation, drop, etc."
                  rows={2}
                  maxLength={500}
                />
              </div>
            </form>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-10"
                onClick={() => onOpenChange(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button type="submit" form="shift-close-form" className="h-10" disabled={pending || !countedValid}>
                {pending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Square className="size-4" aria-hidden />
                )}
                Close shift
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ── Local summary grid (style mirrors the Z-Report stats; no imports shared) ──

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

function ShiftSummary({
  totals,
  expensesPaid,
  openingFloat,
  meta,
}: {
  totals: ShiftCurrent['totals']
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

/** Print-only sheet for the close report (rendered inside .shift-print-area). */
function ShiftClosePaper({ result }: { result: ShiftCloseResult }) {
  const s = result.shift
  return (
    <div className="space-y-3">
      <div className="border-b pb-2">
        <p className="text-sm font-bold">Shift Report · Cash Close</p>
        <p className="text-xs">
          Opened {fmtDate(s.openedAt)} {fmtTime(s.openedAt)}
          {s.openedBy ? ` · ${s.openedBy}` : ''} — closed {fmtDate(s.closedAt ?? '')} {fmtTime(s.closedAt ?? '')}
        </p>
      </div>

      <ShiftSummary
        totals={result.totals}
        expensesPaid={result.expensesPaid}
        openingFloat={s.openingFloat}
      />

      <div className="space-y-1 rounded-lg border p-3">
        <div className="flex items-center justify-between text-sm">
          <span>Counted cash</span>
          <span className="font-bold tabular-nums">{fmtMoney(s.countedCash ?? 0)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span>Expected in drawer</span>
          <span className="font-semibold tabular-nums">{fmtMoney(result.totals.expectedDrawer)}</span>
        </div>
        <div className="flex items-center justify-between border-t pt-1.5 text-base">
          <span className="font-bold">Variance</span>
          <span className="font-bold tabular-nums">{variancePhrase(result.variance)}</span>
        </div>
      </div>

      {s.note && <p className="border-t pt-2 text-xs">Note: {s.note}</p>}
      <p className="text-center text-[10px]">Printed from Circuit Retail ERP</p>
    </div>
  )
}
