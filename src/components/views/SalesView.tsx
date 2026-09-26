'use client'

// ── Sales & Invoices — filterable list, summary chips, CSV export, refund ─────
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  Banknote,
  Copy,
  CreditCard,
  Download,
  Eye,
  FileBarChart2,
  Hash,
  ReceiptText,
  Search,
  Smartphone,
  Tag,
  Timer,
  TrendingUp,
  Undo2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState, ErrorState, PageHeader, Spinner } from '@/components/shared/page-bits'
import { api, qs } from '@/lib/api'
import { cn } from '@/lib/utils'
import { addDaysUTC, currencySymbol, dhakaDateKey, fmtDateTime, fmtMoney, fmtNum } from '@/lib/format'
import type { PaymentMethod, Sale, SaleStatus } from '@/lib/types'
import { useApi } from '@/hooks/use-api'
import { ReceiptDialog } from '@/components/views/sales/receipt'
import { SaleDetailDialog } from '@/components/views/sales/sale-detail'
import { ZReportDialog } from '@/components/views/sales/z-report'
import { XReportDialog } from '@/components/views/sales/x-report'

const PAGE_SIZE = 15

interface SalesResponse {
  sales: Sale[]
  total: number
  summary: {
    count: number
    gross: number
    discounts: number
    refunds: number
    tax: number
    profit: number
  }
}

type MethodFilter = 'ALL' | 'CASH' | 'CARD' | 'MOBILE'
type StatusFilter = 'ALL' | SaleStatus

const METHOD_ICON: Record<string, typeof Banknote> = {
  CASH: Banknote,
  CARD: CreditCard,
  MOBILE: Smartphone,
}

function csvCell(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? '' : String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export default function SalesView() {
  const today = useMemo(() => dhakaDateKey(new Date()), [])
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [method, setMethod] = useState<MethodFilter>('ALL')
  const [status, setStatus] = useState<StatusFilter>('ALL')
  const [searchText, setSearchText] = useState('')
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)

  const [selected, setSelected] = useState<Sale | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [receiptSale, setReceiptSale] = useState<Sale | null>(null)
  const [exporting, setExporting] = useState(false)
  const [zOpen, setZOpen] = useState(false)
  const [xOpen, setXOpen] = useState(false)

  // Debounce the search box (350ms) before it hits the API.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchText.trim()), 350)
    return () => clearTimeout(t)
  }, [searchText])

  // Any filter change resets pagination.
  useEffect(() => {
    setOffset(0)
  }, [from, to, method, status, search])

  const url = `/api/sales${qs({
    from,
    to,
    method: method === 'ALL' ? undefined : method,
    status: status === 'ALL' ? undefined : status,
    search: search || undefined,
    limit: PAGE_SIZE,
    offset,
  })}`

  const { data, loading, error, refetch, setData } = useApi<SalesResponse>(url)

  const sales = data?.sales ?? []
  const summary = data?.summary
  const total = data?.total ?? 0
  const rangeStart = total === 0 ? 0 : offset + 1
  const rangeEnd = Math.min(offset + PAGE_SIZE, total)

  const applyQuickRange = (days: number) => {
    const now = new Date()
    setFrom(dhakaDateKey(addDaysUTC(now, -(days - 1))))
    setTo(today)
  }

  const copyInvoice = async (invoiceNo: string) => {
    try {
      await navigator.clipboard.writeText(invoiceNo)
      toast.success(`Copied ${invoiceNo}`)
    } catch {
      toast.error('Could not copy to clipboard')
    }
  }

  // ── CSV export (client-side, whole filtered set) ────────────────────────────
  const exportCsv = async () => {
    setExporting(true)
    try {
      const rows: Sale[] = []
      let fetchOffset = 0
      let expected = Infinity
      while (rows.length < expected && fetchOffset < 10000) {
        const page = await api.get<SalesResponse>(
          `/api/sales${qs({
            from,
            to,
            method: method === 'ALL' ? undefined : method,
            status: status === 'ALL' ? undefined : status,
            search: search || undefined,
            limit: 500,
            offset: fetchOffset,
          })}`
        )
        expected = page.total
        rows.push(...page.sales)
        if (page.sales.length === 0) break
        fetchOffset += 500
      }

      const header = [
        'Invoice',
        'Date',
        'Customer',
        'Items',
        'Subtotal',
        'Discount',
        'Tax',
        'Total',
        'Paid',
        'Change',
        'Payment',
        'Status',
        'Note',
      ]
      const lines = [header.join(',')]
      for (const s of rows) {
        lines.push(
          [
            s.invoiceNo,
            fmtDateTime(s.createdAt),
            s.customer?.name ?? 'Walk-in Customer',
            s.items.length,
            s.subtotal.toFixed(2),
            s.discount.toFixed(2),
            s.tax.toFixed(2),
            s.total.toFixed(2),
            s.paid.toFixed(2),
            s.change.toFixed(2),
            s.paymentMethod,
            s.status,
            s.note ?? '',
          ]
            .map(csvCell)
            .join(',')
        )
      }

      const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `sales-${from}_to_${to}.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(link.href)
      toast.success(`Exported ${fmtNum(rows.length)} sale${rows.length === 1 ? '' : 's'} to CSV`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  const handleRefunded = (updated: Sale) => {
    setSelected(updated)
    if (data) {
      setData({ ...data, sales: data.sales.map((s) => (s.id === updated.id ? updated : s)) })
    }
    void refetch()
  }

  const symbol = currencySymbol()

  return (
    <div>
      <PageHeader
        icon={ReceiptText}
        title="Sales & Invoices"
        subtitle="Browse, reprint or refund completed sales"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="h-10 border-sky-500/40 text-sky-700 hover:bg-sky-500/10 dark:text-sky-400"
              onClick={() => setXOpen(true)}
            >
              <Timer className="size-4" aria-hidden />
              X-Report
            </Button>
            <Button variant="outline" className="h-10" onClick={() => setZOpen(true)}>
              <FileBarChart2 className="size-4" aria-hidden />
              Z-Report
            </Button>
            <Button variant="outline" className="h-10" disabled={exporting} onClick={() => void exportCsv()}>
              {exporting ? <Spinner className="size-4" /> : <Download className="size-4" aria-hidden />}
              Export CSV
            </Button>
          </div>
        }
      />

      {/* Summary chips */}
      <div className="mb-3 flex flex-wrap gap-2" aria-label="Filtered sales summary">
        <SummaryChip icon={Hash} label="Transactions" value={fmtNum(summary?.count ?? 0)} />
        <SummaryChip icon={Banknote} label="Gross" value={fmtMoney(summary?.gross ?? 0)} />
        <SummaryChip icon={Tag} label="Discounts" value={fmtMoney(summary?.discounts ?? 0)} />
        <SummaryChip
          icon={Undo2}
          label="Refunds"
          value={fmtMoney(summary?.refunds ?? 0)}
          destructive={(summary?.refunds ?? 0) > 0}
        />
        <SummaryChip icon={TrendingUp} label="Profit" value={fmtMoney(summary?.profit ?? 0)} positive />
      </div>

      {/* Filters */}
      <Card className="mb-4 shadow-sm">
        <CardContent className="flex flex-wrap items-center gap-2 p-4">
          <div className="flex items-center gap-1.5">
            <Input
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
              aria-label="From date"
              className="h-9 w-[8.5rem] text-xs"
            />
            <span className="text-xs text-muted-foreground">→</span>
            <Input
              type="date"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
              aria-label="To date"
              className="h-9 w-[8.5rem] text-xs"
            />
          </div>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => applyQuickRange(1)}
              className="h-9 rounded-full border px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => applyQuickRange(7)}
              className="h-9 rounded-full border px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              7d
            </button>
            <button
              type="button"
              onClick={() => applyQuickRange(30)}
              className="h-9 rounded-full border px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              30d
            </button>
          </div>
          <Select value={method} onValueChange={(v) => setMethod(v as MethodFilter)}>
            <SelectTrigger className="h-9 w-32 text-xs" aria-label="Payment method filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All methods</SelectItem>
              <SelectItem value="CASH">Cash</SelectItem>
              <SelectItem value="CARD">Card</SelectItem>
              <SelectItem value="MOBILE">Mobile</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
            <SelectTrigger className="h-9 w-36 text-xs" aria-label="Status filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
              <SelectItem value="REFUNDED">Refunded</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative min-w-40 flex-1">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Invoice or customer…"
              aria-label="Search sales"
              className="h-9 pl-8 text-xs"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          {error ? (
            <div className="p-4">
              <ErrorState message={error} onRetry={() => void refetch()} />
            </div>
          ) : loading && !data ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full rounded-md" />
              ))}
            </div>
          ) : sales.length === 0 ? (
            <EmptyState
              icon={ReceiptText}
              title="No sales match your filters"
              message="Try widening the date range or clearing the search."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFrom(today)
                    setTo(today)
                    setMethod('ALL')
                    setStatus('ALL')
                    setSearchText('')
                  }}
                >
                  Reset filters
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-4">Invoice</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-center">Items</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="w-12 pr-4" aria-label="Actions" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && data
                    ? sales.map((s) => (
                        <TableRow key={s.id} className="opacity-50">
                          <TableCell className="pl-4 font-mono text-xs">{s.invoiceNo}</TableCell>
                          <TableCell colSpan={7}>
                            <Spinner className="size-3.5 text-muted-foreground" />
                          </TableCell>
                        </TableRow>
                      ))
                    : sales.map((s) => {
                        const refunded = s.status === 'REFUNDED'
                        const Icon = METHOD_ICON[s.paymentMethod] ?? Banknote
                        return (
                          <TableRow key={s.id}>
                            <TableCell className="pl-4">
                              <button
                                type="button"
                                onClick={() => void copyInvoice(s.invoiceNo)}
                                aria-label={`Copy invoice number ${s.invoiceNo}`}
                                className="group inline-flex items-center gap-1.5 font-mono text-xs font-semibold hover:underline"
                                title="Click to copy"
                              >
                                {s.invoiceNo}
                                <Copy className="size-3 opacity-0 transition-opacity group-hover:opacity-60" aria-hidden />
                              </button>
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                              {fmtDateTime(s.createdAt)}
                            </TableCell>
                            <TableCell className="max-w-40 truncate text-xs">
                              {s.customer?.name ?? 'Walk-in Customer'}
                            </TableCell>
                            <TableCell className="text-center text-xs tabular-nums">{s.items.length}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="gap-1 text-[11px] font-medium">
                                <Icon className="size-3" aria-hidden />
                                {s.paymentMethod}
                              </Badge>
                              {!refunded && (s.due ?? 0) > 0 && (
                                <Badge
                                  variant="outline"
                                  className="ml-1.5 border-amber-500/40 bg-amber-500/10 text-[10px] font-semibold text-amber-700 dark:text-amber-400"
                                  title="Partially paid — outstanding credit"
                                >
                                  CREDIT
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {refunded ? (
                                <Badge variant="destructive" className="text-[11px]">
                                  REFUNDED
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[11px] text-emerald-600 dark:text-emerald-400">
                                  COMPLETED
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell
                              className={cn(
                                'whitespace-nowrap pr-2 text-right text-sm font-bold tabular-nums',
                                refunded && 'text-red-600 line-through dark:text-red-400'
                              )}
                            >
                              {fmtMoney(s.total)}
                            </TableCell>
                            <TableCell className="pr-4">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-9"
                                aria-label={`View invoice ${s.invoiceNo}`}
                                onClick={() => {
                                  setSelected(s)
                                  setDetailOpen(true)
                                }}
                              >
                                <Eye className="size-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {total > 0 && (
            <div className="flex items-center justify-between gap-2 border-t px-4 py-3">
              <p className="text-xs tabular-nums text-muted-foreground">
                {fmtNum(rangeStart)}–{fmtNum(rangeEnd)} of {fmtNum(total)}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9"
                  disabled={offset === 0 || loading}
                  onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                  aria-label="Previous page"
                >
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9"
                  disabled={rangeEnd >= total || loading}
                  onClick={() => setOffset(offset + PAGE_SIZE)}
                  aria-label="Next page"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        Dates are {symbol === '৳' ? 'Asia/Dhaka' : 'store-local'} calendar days · amounts in {symbol}
      </p>

      {/* Detail + receipt dialogs */}
      <SaleDetailDialog
        sale={selected}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onPrint={(s) => setReceiptSale(s)}
        onRefunded={handleRefunded}
      />
      <ReceiptDialog sale={receiptSale} onDone={() => setReceiptSale(null)} />
      <ZReportDialog open={zOpen} onOpenChange={setZOpen} />
      <XReportDialog open={xOpen} onOpenChange={setXOpen} />
    </div>
  )
}

function SummaryChip({
  icon: Icon,
  label,
  value,
  destructive = false,
  positive = false,
}: {
  icon: typeof Banknote
  label: string
  value: string
  destructive?: boolean
  positive?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5',
        destructive && 'border-destructive/30 bg-destructive/5'
      )}
    >
      <Icon
        className={cn('size-3.5', destructive ? 'text-destructive' : 'text-muted-foreground')}
        aria-hidden
      />
      <div className="leading-tight">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p
          className={cn(
            'text-sm font-semibold tabular-nums',
            destructive && 'text-destructive',
            positive && 'text-emerald-600 dark:text-emerald-400'
          )}
        >
          {value}
        </p>
      </div>
    </div>
  )
}
