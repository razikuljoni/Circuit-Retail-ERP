'use client'

// ── Reports: Products tab + Daily tab (sortable tables + CSV export) ────────
import { useMemo, useState } from 'react'
import { ArrowDownWideNarrow, CalendarOff, Download } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState } from '@/components/shared/page-bits'
import { fmtMoney, fmtNum, fmtQty } from '@/lib/format'
import type { DailySalesRow, ProductPerformance } from '@/lib/types'
import { downloadCsv } from './reports-utils'

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2.5">
      <Skeleton className="h-10 w-full rounded-lg" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-11 w-full rounded-lg" style={{ opacity: 1 - i * 0.08 }} />
      ))}
    </div>
  )
}

// ── Products tab ─────────────────────────────────────────────────────────────

type ProductSortKey = 'revenue' | 'profit' | 'qty' | 'margin'

const PRODUCT_SORTS: { key: ProductSortKey; label: string }[] = [
  { key: 'revenue', label: 'Revenue' },
  { key: 'profit', label: 'Profit' },
  { key: 'qty', label: 'Qty sold' },
  { key: 'margin', label: 'Margin' },
]

function marginBadgeClass(margin: number): string {
  if (margin < 10) return 'border-red-300 text-red-600 dark:border-red-900 dark:text-red-400'
  if (margin >= 30) return 'border-emerald-300 text-emerald-700 dark:border-emerald-900 dark:text-emerald-400'
  return ''
}

export function ProductsTab({ data, from, to }: { data: ProductPerformance[]; from: string; to: string }) {
  const [sort, setSort] = useState<ProductSortKey>('revenue')

  const sorted = useMemo(
    () => [...data].sort((a, b) => b[sort] - a[sort]),
    [data, sort]
  )

  const exportCsv = () => {
    const count = downloadCsv(
      `product-performance_${from}_${to}.csv`,
      ['Rank', 'Product', 'SKU', 'Qty Sold', 'Revenue', 'Profit', 'Margin %'],
      sorted.map((p, i) => [i + 1, p.name, p.sku, p.qty, p.revenue, p.profit, p.margin.toFixed(1)])
    )
    toast.success(`Exported ${count} products to CSV`)
  }

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          Product performance
          <Badge variant="secondary">{data.length}</Badge>
        </CardTitle>
        <CardDescription className="text-xs">
          {fmtNum(data.length)} products sold between {from} and {to}
        </CardDescription>
        <CardAction className="flex items-center gap-2">
          <Select value={sort} onValueChange={(v) => setSort(v as ProductSortKey)}>
            <SelectTrigger size="sm" className="w-[140px]" aria-label="Sort products by">
              <ArrowDownWideNarrow className="size-3.5 text-muted-foreground" aria-hidden />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRODUCT_SORTS.map((s) => (
                <SelectItem key={s.key} value={s.key}>
                  Sort: {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={sorted.length === 0}>
            <Download className="size-3.5" aria-hidden />
            CSV
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <EmptyState
            icon={CalendarOff}
            title="No data in this range"
            message="No completed sale items fall inside these dates."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Qty Sold</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Profit</TableHead>
                <TableHead className="text-right">Margin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((p, i) => (
                <TableRow key={p.id}>
                  <TableCell className="text-muted-foreground tabular-nums">{i + 1}</TableCell>
                  <TableCell className="max-w-[280px]">
                    <span className="block truncate font-medium">{p.name}</span>
                    <span className="block truncate font-mono text-xs text-muted-foreground">{p.sku}</span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{fmtQty(p.qty)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtMoney(p.revenue)}</TableCell>
                  <TableCell
                    className={`text-right font-medium tabular-nums ${
                      p.profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {fmtMoney(p.profit)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline" className={`tabular-nums ${marginBadgeClass(p.margin)}`}>
                      {p.margin.toFixed(1)}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

// ── Daily tab ────────────────────────────────────────────────────────────────

const DAILY_MONEY_COLS: (keyof Pick<DailySalesRow, 'gross' | 'discounts' | 'refunds' | 'cogs' | 'profit' | 'expenses' | 'net'>)[] = [
  'gross',
  'discounts',
  'refunds',
  'cogs',
  'profit',
  'expenses',
  'net',
]

function moneyClass(v: number): string {
  return v >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
}

export function DailyTab({ data, from, to }: { data: DailySalesRow[]; from: string; to: string }) {
  const totals = useMemo(() => {
    const t = {
      transactions: 0,
      gross: 0,
      discounts: 0,
      refunds: 0,
      cogs: 0,
      profit: 0,
      expenses: 0,
      net: 0,
    }
    for (const r of data) {
      t.transactions += r.transactions
      t.gross += r.gross
      t.discounts += r.discounts
      t.refunds += r.refunds
      t.cogs += r.cogs
      t.profit += r.profit
      t.expenses += r.expenses
      t.net += r.net
    }
    return t
  }, [data])

  const exportCsv = () => {
    const count = downloadCsv(
      `daily-sales_${from}_${to}.csv`,
      ['Date', 'Transactions', 'Gross', 'Discounts', 'Refunds', 'COGS', 'Profit', 'Expenses', 'Net'],
      data.map((r) => [r.date, r.transactions, r.gross, r.discounts, r.refunds, r.cogs, r.profit, r.expenses, r.net])
    )
    toast.success(`Exported ${count} daily rows to CSV`)
  }

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          Daily summary
          <Badge variant="secondary">{data.length} days</Badge>
        </CardTitle>
        <CardDescription className="text-xs">
          Per-day sales, costs and net for {from} → {to}
        </CardDescription>
        <CardAction>
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={data.length === 0}>
            <Download className="size-3.5" aria-hidden />
            CSV
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <EmptyState
            icon={CalendarOff}
            title="No data in this range"
            message="No sales were recorded on these dates."
          />
        ) : (
          <div className="max-h-[540px] overflow-y-auto rounded-lg border" tabIndex={0} aria-label="Daily sales table, scrollable">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Txns</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Discounts</TableHead>
                  <TableHead className="text-right">Refunds</TableHead>
                  <TableHead className="text-right">COGS</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                  <TableHead className="text-right">Expenses</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((r) => (
                  <TableRow key={r.date}>
                    <TableCell className="whitespace-nowrap font-medium">
                      {r.label}
                      <span className="ml-1.5 font-mono text-xs text-muted-foreground">{r.date}</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{fmtQty(r.transactions)}</TableCell>
                    {DAILY_MONEY_COLS.map((k) => (
                      <TableCell
                        key={k}
                        className={`text-right tabular-nums ${k === 'profit' || k === 'net' ? `font-medium ${moneyClass(r[k])}` : ''}`}
                      >
                        {fmtMoney(r[k])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="font-semibold">Total</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{fmtQty(totals.transactions)}</TableCell>
                  {DAILY_MONEY_COLS.map((k) => (
                    <TableCell
                      key={k}
                      className={`text-right font-semibold tabular-nums ${
                        k === 'profit' || k === 'net' ? moneyClass(totals[k]) : ''
                      }`}
                    >
                      {fmtMoney(totals[k])}
                    </TableCell>
                  ))}
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
