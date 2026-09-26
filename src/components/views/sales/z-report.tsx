'use client'

// ── Z-Report (end-of-day) — single-day register summary, printable ───────────
// Data: GET /api/reports?type=zreport&from=YYYY-MM-DD (Dhaka day key)
import { useState } from 'react'
import {
  Banknote,
  CreditCard,
  FileBarChart2,
  Printer,
  Smartphone,
  Store,
  Wallet,
} from 'lucide-react'
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
import { currencySymbol, dhakaDateKey, fmtMoney } from '@/lib/format'
import type { ZReport } from '@/lib/types'

const METHOD_ICON: Record<string, typeof Banknote> = {
  CASH: Banknote,
  CARD: CreditCard,
  MOBILE: Smartphone,
  BANK: Wallet,
}

export function ZReportDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-4" aria-describedby={undefined}>
        {open && <ZReportForm onOpenChange={onOpenChange} />}
      </DialogContent>
    </Dialog>
  )
}

function ZReportForm({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const [date, setDate] = useState(() => dhakaDateKey(new Date()))
  const symbol = currencySymbol()

  const url = `/api/reports?type=zreport&from=${encodeURIComponent(date)}&to=${encodeURIComponent(date)}`
  const { data: report, loading, error } = useApi<ZReport>(url)

  const print = () => {
    document.body.classList.add('printing-zreport')
    window.print()
    // Remove the tag after the print dialog interaction settles
    setTimeout(() => document.body.classList.remove('printing-zreport'), 500)
  }

  const maxHourly = Math.max(1, ...(report?.hourly ?? []).map((h) => h.sales))

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-base">
          <FileBarChart2 className="size-4 text-primary" aria-hidden /> Z-Report — end of day
        </DialogTitle>
        <DialogDescription className="text-xs">
          Register-style daily summary for the selected {symbol === '৳' ? 'Asia/Dhaka' : 'store-local'} calendar day.
        </DialogDescription>
      </DialogHeader>

      <div className="flex items-center gap-2">
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-label="Z-report date"
          className="h-9 w-40 text-xs"
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
          <Printer className="size-4" /> Print Z-report
        </Button>
      </DialogFooter>

      {/* Hidden print clone — inline display:none (print CSS overrides with !important) */}
      {report && (
        <div className="zreport-print-area" style={{ display: 'none' }} aria-hidden>
          <ZReportBody report={report} maxHourly={maxHourly} symbol={symbol} printHeader />
        </div>
      )}
    </>
  )
}

function ZReportBody({
  report,
  maxHourly,
  symbol,
  printHeader = false,
}: {
  report: ZReport
  maxHourly: number
  symbol: string
  printHeader?: boolean
}) {
  return (
    <div className="space-y-4">
      {printHeader && (
        <div className="border-b pb-2">
          <p className="flex items-center gap-1.5 text-sm font-bold">
            <Store className="size-3.5" /> Z-Report · End of Day
          </p>
          <p className="text-xs">{report.label} — Circuit Retail ERP</p>
        </div>
      )}

      {/* Headline totals */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <ZrStat label="Net sales" value={fmtMoney(report.netSales)} strong />
        <ZrStat label="Gross sales" value={fmtMoney(report.gross)} />
        <ZrStat label="Discounts" value={fmtMoney(report.discounts)} />
        <ZrStat
          label="Refunds"
          value={fmtMoney(report.refunds)}
          tone={report.refunds > 0 ? 'bad' : undefined}
          sub={report.refundCount > 0 ? `${report.refundCount} transaction${report.refundCount === 1 ? '' : 's'}` : undefined}
        />
        <ZrStat label="Tax collected" value={fmtMoney(report.tax)} />
        <ZrStat label="Gross profit" value={fmtMoney(report.grossProfit)} tone="good" />
        <ZrStat label="Expenses" value={fmtMoney(report.expensesTotal)} tone="bad" />
        <ZrStat label="Net profit" value={fmtMoney(report.netProfit)} strong tone={report.netProfit >= 0 ? 'good' : 'bad'} />
      </div>

      {/* Payments + drawer */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Payments received ({report.transactions})
          </p>
          <div className="space-y-1.5">
            {report.byMethod.length === 0 ? (
              <p className="text-xs text-muted-foreground">No completed sales this day.</p>
            ) : (
              report.byMethod.map((m) => {
                const Icon = METHOD_ICON[m.method] ?? Banknote
                return (
                  <div key={m.method} className="flex items-center justify-between text-sm">
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <Icon className="size-3.5" aria-hidden /> {m.method}
                      <span className="text-[11px]">× {m.count}</span>
                    </span>
                    <span className="font-semibold tabular-nums">{fmtMoney(m.amount)}</span>
                  </div>
                )
              })
            )}
          </div>
          <div className="mt-2 border-t pt-2 text-xs text-muted-foreground">
            Items sold: <span className="font-semibold text-foreground tabular-nums">{report.itemsSold}</span>
            {' · '}Avg basket: <span className="font-semibold text-foreground tabular-nums">{fmtMoney(report.avgBasket)}</span>
          </div>
        </div>

        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
            Cash drawer reconciliation
          </p>
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Banknote className="size-3.5" aria-hidden /> Cash sales
              </span>
              <span className="font-semibold tabular-nums">+{fmtMoney(report.byMethod.find((m) => m.method === 'CASH')?.amount ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Wallet className="size-3.5" aria-hidden /> Cash expenses
              </span>
              <span className="font-semibold tabular-nums text-red-600 dark:text-red-400">−{fmtMoney(report.cashExpenses)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-emerald-500/30 pt-2">
              <span className="font-semibold">Expected in drawer</span>
              <span className="text-base font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                {fmtMoney(report.expectedCash)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Hourly distribution (CSS bars, print-safe) */}
      <div className="rounded-lg border p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Sales by hour
        </p>
        <div className="flex h-20 items-end gap-[3px]">
          {report.hourly.map((h) => {
            const pct = Math.max(2, (h.sales / maxHourly) * 100)
            return (
              <div key={h.hour} className="group relative flex h-full flex-1 items-end" title={`${h.label}: ${fmtMoney(h.sales)} (${h.transactions} tx)`}>
                <div
                  className="zr-bar w-full rounded-t-[2px] bg-primary/70"
                  style={{ height: `${h.sales > 0 ? pct : 1.5}%` }}
                />
              </div>
            )
          })}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
          <span>12 AM</span>
          <span>6 AM</span>
          <span>12 PM</span>
          <span>6 PM</span>
          <span>11 PM</span>
        </div>
      </div>

      {/* Top items */}
      {report.topItems.length > 0 && (
        <div className="rounded-lg border">
          <p className="border-b px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Best sellers of the day
          </p>
          <div className="divide-y">
            {report.topItems.map((it) => (
              <div key={it.sku || it.name} className="flex items-center justify-between gap-3 px-3 py-1.5 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{it.name}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">{it.sku}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="mr-3 text-xs text-muted-foreground tabular-nums">×{it.qty}</span>
                  <span className="font-semibold tabular-nums">{fmtMoney(it.revenue)}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {printHeader && (
        <p className="text-center text-[10px]">
          {symbol === '৳' ? 'Currency: BDT (৳) · Times in Asia/Dhaka' : `Currency: ${symbol}`} — printed from Circuit Retail ERP
        </p>
      )}
    </div>
  )
}

function ZrStat({
  label,
  value,
  sub,
  strong = false,
  tone,
}: {
  label: string
  value: string
  sub?: string
  strong?: boolean
  tone?: 'good' | 'bad'
}) {
  return (
    <div className="rounded-lg border px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={`mt-0.5 tabular-nums ${
          strong ? 'text-base font-bold' : 'text-sm font-semibold'
        } ${tone === 'good' ? 'text-emerald-600 dark:text-emerald-400' : tone === 'bad' ? 'text-red-600 dark:text-red-400' : ''}`}
      >
        {value}
      </p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  )
}
