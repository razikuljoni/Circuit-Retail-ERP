'use client'

// ── Supplier statement dialog — portfolio, PO history, stats + A4 print ─────
// Uses the shared `.report-print-area` clone pattern (body gets
// `printing-report` while printing) so the same ink-friendly CSS applies.
import { FileText, Loader2, Printer, Truck } from 'lucide-react'
import { currencySymbol, fmtDate, fmtDateTime, fmtMoney, fmtQty } from '@/lib/format'
import type { SupplierStatement } from '@/lib/types'
import { useApi } from '@/hooks/use-api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/shared/page-bits'
import { PoStatusBadge } from '@/components/views/inventory/purchase-orders'
import { useUiStore } from '@/store/ui'

function Stat({ label, value, tone, accent }: { label: string; value: string; tone?: string; accent?: string }) {
  return (
    <div className="relative overflow-hidden rounded-lg border bg-muted/40 px-3 py-2 min-w-0">
      {accent && <span aria-hidden className={`absolute inset-x-0 top-0 h-[2.5px] ${accent}`} />}
      <p className="text-[11px] font-medium text-muted-foreground truncate">{label}</p>
      <p className={`text-sm font-bold tabular-nums truncate ${tone ?? ''}`}>{value}</p>
    </div>
  )
}

export function SupplierStatementDialog({
  supplierId,
  supplierName,
  onClose,
}: {
  supplierId: string | null
  supplierName: string
  onClose: () => void
}) {
  const open = supplierId !== null
  const { data, loading, error } = useApi<SupplierStatement>(
    open && supplierId ? `/api/suppliers/${supplierId}/statement` : null
  )
  const storeName = useUiStore((s) => s.settings?.storeName ?? 'Circuit Store')

  const print = () => {
    document.body.classList.add('printing-report')
    window.print()
    setTimeout(() => document.body.classList.remove('printing-report'), 500)
  }

  const symbol = currencySymbol()
  const s = data
  const potentialMargin =
    s && s.portfolio.stockCostValue > 0
      ? ((s.portfolio.stockRetailValue - s.portfolio.stockCostValue) / s.portfolio.stockCostValue) * 100
      : null

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="sm:max-w-3xl max-h-[88vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="size-4.5 text-primary" />
              Supplier statement
              <span className="text-muted-foreground font-normal">· {supplierName}</span>
            </DialogTitle>
            <DialogDescription>
              Purchase orders, supplied products and value at a glance.
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-14">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <p className="py-8 text-center text-sm text-destructive">{error}</p>
          ) : !s ? null : (
            <div className="space-y-4 overflow-y-auto min-h-0 pr-1">
              {/* Portfolio + PO stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Stat label="Products supplied" value={String(s.portfolio.count)} accent="bg-primary/60" />
                <Stat label="Units in stock" value={fmtQty(s.portfolio.units)} accent="bg-sky-500/60" />
                <Stat
                  label="Stock value (cost)"
                  value={fmtMoney(s.portfolio.stockCostValue, { compact: true })}
                  tone="text-emerald-600 dark:text-emerald-400"
                  accent="bg-emerald-500/60"
                />
                <Stat
                  label="Open PO value"
                  value={fmtMoney(s.poStats.openValue, { compact: true })}
                  tone={s.poStats.openValue > 0 ? 'text-amber-600 dark:text-amber-400' : ''}
                  accent="bg-amber-500/60"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <Badge variant="secondary" className="tabular-nums">
                  {s.poStats.total} PO{s.poStats.total === 1 ? '' : 's'}
                </Badge>
                {s.poStats.received > 0 && (
                  <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 tabular-nums">
                    {s.poStats.received} received · {fmtMoney(s.poStats.receivedValue, { compact: true })}
                  </Badge>
                )}
                {s.poStats.ordered > 0 && (
                  <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 tabular-nums">
                    {s.poStats.ordered} awaiting
                  </Badge>
                )}
                {s.poStats.draft > 0 && (
                  <Badge variant="outline" className="tabular-nums">
                    {s.poStats.draft} draft{s.poStats.draft === 1 ? '' : 's'}
                  </Badge>
                )}
                {s.portfolio.lowStock > 0 && (
                  <Badge variant="outline" className="border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400 tabular-nums">
                    {s.portfolio.lowStock} low stock
                  </Badge>
                )}
                {potentialMargin !== null && (
                  <Badge variant="outline" className="tabular-nums">
                    margin {potentialMargin.toFixed(0)}%
                  </Badge>
                )}
                <span className="ml-auto text-muted-foreground">
                  last order {s.poStats.lastOrderAt ? fmtDate(s.poStats.lastOrderAt) : '—'}
                </span>
              </div>

              {/* PO history */}
              {s.orders.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="No purchase orders yet"
                  message="Draft POs from the low-stock list to start this supplier's history."
                />
              ) : (
                <div className="rounded-lg border overflow-y-auto max-h-80">
                  <Table>
                    <TableHeader className="sticky top-0 bg-muted/90 backdrop-blur z-10">
                      <TableRow>
                        <TableHead className="pl-3">PO #</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-center">Items</TableHead>
                        <TableHead className="text-center">Qty</TableHead>
                        <TableHead className="text-right">Cost</TableHead>
                        <TableHead className="text-right pr-3">Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {s.orders.map((o) => (
                        <TableRow key={o.id}>
                          <TableCell className="pl-3 font-mono text-xs font-semibold whitespace-nowrap">
                            {o.poNo}
                          </TableCell>
                          <TableCell>
                            <PoStatusBadge status={o.status} />
                          </TableCell>
                          <TableCell className="text-center text-sm tabular-nums">{o.itemCount}</TableCell>
                          <TableCell className="text-center text-sm tabular-nums text-muted-foreground">
                            {fmtQty(o.totalQty)}
                          </TableCell>
                          <TableCell className="text-right text-sm font-semibold tabular-nums whitespace-nowrap">
                            {fmtMoney(o.totalCost)}
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap pr-3">
                            {fmtDate(o.createdAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Top products by value at cost */}
              {s.portfolio.topProducts.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                    Top products by stock value
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {s.portfolio.topProducts.slice(0, 6).map((p) => (
                      <Badge key={p.sku} variant="outline" className="gap-1.5 max-w-full">
                        <span className="truncate max-w-44" title={p.name}>{p.name}</span>
                        <span className="text-muted-foreground tabular-nums shrink-0">
                          {fmtQty(p.stock)} {p.unit} · {fmtMoney(p.stockCostValue, { compact: true })}
                        </span>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button variant="outline" size="sm" className="h-9" disabled={!s} onClick={print}>
              <Printer className="size-3.5" aria-hidden /> Print statement
            </Button>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hidden A4 print clone */}
      {s && (
        <div className="report-print-area" style={{ display: 'none' }} aria-hidden>
          <div style={{ textAlign: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '0.02em' }}>{storeName}</div>
            <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>Supplier Statement</div>
            <div style={{ fontSize: 10.5, color: '#475569' }}>
              {s.supplier.name}
              {s.supplier.phone ? ` · ${s.supplier.phone}` : ''}
              {s.supplier.address ? ` · ${s.supplier.address}` : ''} · generated {fmtDateTime(s.generatedAt)}
            </div>
          </div>

          <table style={{ marginBottom: 14 }}>
            <tbody>
              <tr>
                <td>Products supplied</td>
                <td className="num">{s.portfolio.count}</td>
              </tr>
              <tr>
                <td>Units in stock</td>
                <td className="num">{s.portfolio.units}</td>
              </tr>
              <tr>
                <td>Stock value at cost</td>
                <td className="num">{fmtMoney(s.portfolio.stockCostValue)}</td>
              </tr>
              <tr>
                <td>Stock value at retail</td>
                <td className="num">{fmtMoney(s.portfolio.stockRetailValue)}</td>
              </tr>
              <tr className="rep-total">
                <td>Potential margin</td>
                <td className="num">{potentialMargin !== null ? `${potentialMargin.toFixed(1)}%` : '—'}</td>
              </tr>
            </tbody>
          </table>

          <div style={{ fontSize: 12, fontWeight: 700, margin: '10px 0 6px' }}>Purchase orders ({s.poStats.total})</div>
          <table>
            <thead>
              <tr>
                <th style={{ width: '22%' }}>PO #</th>
                <th style={{ width: '16%' }}>Status</th>
                <th className="num" style={{ width: '14%' }}>Items</th>
                <th className="num" style={{ width: '16%' }}>Qty</th>
                <th className="num">Cost</th>
                <th style={{ width: '14%' }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {s.orders.map((o) => (
                <tr key={o.id}>
                  <td>{o.poNo}</td>
                  <td>{o.status}</td>
                  <td className="num">{o.itemCount}</td>
                  <td className="num">{o.totalQty}</td>
                  <td className="num">{fmtMoney(o.totalCost)}</td>
                  <td>{fmtDate(o.createdAt)}</td>
                </tr>
              ))}
              <tr className="rep-total">
                <td colSpan={4}>Received value {fmtMoney(s.poStats.receivedValue)} · Open value {fmtMoney(s.poStats.openValue)}</td>
                <td className="num">{fmtMoney(s.orders.reduce((sum, o) => sum + o.totalCost, 0))}</td>
                <td />
              </tr>
            </tbody>
          </table>

          <div style={{ marginTop: 16, fontSize: 9.5, color: '#64748b', textAlign: 'center' }}>
            Figures in {symbol} · Values at current product cost/retail, not historical PO price ·
            POs shown: last {s.orders.length} of {s.poStats.total}.
          </div>
        </div>
      )}
    </>
  )
}
