'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  AlertTriangle,
  Download,
  Package,
  PackagePlus,
  Plus,
  SlidersHorizontal,
  Warehouse,
} from 'lucide-react'
import { api, qs } from '@/lib/api'
import { cn } from '@/lib/utils'
import { addDaysUTC, dhakaDateKey, fmtDateTime, fmtMoney, fmtQty } from '@/lib/format'
import type { Product, StockMovement } from '@/lib/types'
import { useApi } from '@/hooks/use-api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { CoverBadge } from '@/components/views/inventory/cover-badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PageHeader, EmptyState, ErrorState, ViewLoader } from '@/components/shared/page-bits'
import { StatCard } from '@/components/shared/stat-card'
import { AdjustDialog, type AdjustType } from './inventory/adjust-dialog'
import { MovementBadge } from './inventory/movement-type'
import { downloadMovementsCsv } from './inventory/csv'

const LEDGER_PAGE = 50
const LEDGER_LIMIT = 200

export default function InventoryView() {
  // ── Data ──
  const productsQ = useApi<Product[]>('/api/products?limit=500&status=active&sort=name')
  const products = productsQ.data ?? []

  const [tab, setTab] = useState('levels')

  // Ledger filters
  const [type, setType] = useState('all')
  const [from, setFrom] = useState(() => dhakaDateKey(addDaysUTC(new Date(), -6)))
  const [to, setTo] = useState(() => dhakaDateKey(new Date()))
  const [ledgerSearch, setLedgerSearch] = useState('')
  const [visible, setVisible] = useState(LEDGER_PAGE)

  const movementsUrl =
    '/api/stock/movements' +
    qs({ type: type === 'all' ? undefined : type, from, to, limit: LEDGER_LIMIT })
  const movementsQ = useApi<StockMovement[]>(movementsUrl)
  const movements = movementsQ.data ?? []

  // Reset pagination when the filter set changes
  useEffect(() => {
    setVisible(LEDGER_PAGE)
  }, [type, from, to, ledgerSearch])

  // ── Stats from the product list (client-side) ──
  const stats = useMemo(() => {
    let cost = 0
    let retail = 0
    let low = 0
    let out = 0
    for (const p of products) {
      cost += p.stock * p.costPrice
      retail += p.stock * p.price
      if (p.stock <= 0) out++
      else if (p.stock <= p.reorderLevel) low++
    }
    return { cost, retail, low, out }
  }, [products])

  const lowStockProducts = useMemo(
    () => products.filter((p) => p.stock <= p.reorderLevel).sort((a, b) => a.stock - b.stock),
    [products]
  )

  const filteredMovements = useMemo(() => {
    const q = ledgerSearch.trim().toLowerCase()
    if (!q) return movements
    return movements.filter(
      (m) => m.product?.name.toLowerCase().includes(q) || m.product?.sku.toLowerCase().includes(q)
    )
  }, [movements, ledgerSearch])
  const shownMovements = filteredMovements.slice(0, visible)

  // ── Adjust dialog state ──
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [adjustProductId, setAdjustProductId] = useState<string | null>(null)
  const [adjustType, setAdjustType] = useState<AdjustType>('PURCHASE')

  // ── Quick restock ──
  const [restockId, setRestockId] = useState<string | null>(null)
  async function quickRestock(p: Product) {
    setRestockId(p.id)
    try {
      await api.post('/api/stock/adjust', {
        productId: p.id,
        type: 'PURCHASE',
        qty: 10,
        note: 'Quick restock',
        reference: null,
      })
      toast.success(`Received 10 ${p.unit} of "${p.name}"`)
      productsQ.refetch()
      movementsQ.refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to receive stock')
    } finally {
      setRestockId(null)
    }
  }

  function openAdjust(productId: string | null, t: AdjustType) {
    setAdjustProductId(productId)
    setAdjustType(t)
    setAdjustOpen(true)
  }

  const showSkeleton = productsQ.loading && !productsQ.data
  if (showSkeleton) return <ViewLoader />

  return (
    <div>
      <PageHeader
        icon={Warehouse}
        title="Inventory & Stock"
        subtitle="Receive, adjust and audit stock movements"
        actions={
          <>
            <Button variant="outline" onClick={() => downloadMovementsCsv(movements)} disabled={movements.length === 0}>
              <Download className="size-4" />
              <span className="hidden sm:inline">Export movements</span>
              <span className="sm:hidden">CSV</span>
            </Button>
            <Button onClick={() => openAdjust(null, 'PURCHASE')}>
              <Plus className="size-4" />
              Stock movement
            </Button>
          </>
        }
      />

      {productsQ.error && !productsQ.data ? (
        <ErrorState message={productsQ.error} onRetry={productsQ.refetch} />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <StatCard
              title="Stock value (cost)"
              value={fmtMoney(stats.cost, { compact: true })}
              icon={Package}
              iconClassName="bg-emerald-500/10 [&_svg]:text-emerald-600 dark:[&_svg]:text-emerald-400"
            />
            <StatCard
              title="Stock value (retail)"
              value={fmtMoney(stats.retail, { compact: true })}
              icon={Package}
              iconClassName="bg-teal-500/10 [&_svg]:text-teal-600 dark:[&_svg]:text-teal-400"
            />
            <StatCard
              title="Low stock"
              value={String(stats.low)}
              hint="at or below reorder level"
              icon={AlertTriangle}
              iconClassName="bg-amber-500/10 [&_svg]:text-amber-600 dark:[&_svg]:text-amber-400"
            />
            <StatCard
              title="Out of stock"
              value={String(stats.out)}
              hint="needs immediate restock"
              icon={AlertTriangle}
              iconClassName="bg-red-500/10 [&_svg]:text-red-600 dark:[&_svg]:text-red-400"
            />
          </div>

          <Tabs value={tab} onValueChange={setTab} className="space-y-4">
            <TabsList className="h-10 w-full sm:w-auto sm:grid sm:grid-cols-3">
              <TabsTrigger value="levels">Stock levels</TabsTrigger>
              <TabsTrigger value="low">
                Low stock
                {stats.low + stats.out > 0 && (
                  <Badge variant="secondary" className="ml-1.5 h-4.5 px-1.5">
                    {stats.low + stats.out}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="ledger">Movement ledger</TabsTrigger>
            </TabsList>

            {/* ── Stock levels ── */}
            {tab === 'levels' && (
              <Card className="overflow-hidden">
                {products.length === 0 ? (
                  <EmptyState
                    icon={Warehouse}
                    title="No active products"
                    message="Add products first, then receive stock here."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <Table className="min-w-[820px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[120px]">SKU</TableHead>
                          <TableHead>Product</TableHead>
                          <TableHead className="hidden md:table-cell">Stock</TableHead>
                          <TableHead className="text-right">Cost value</TableHead>
                          <TableHead className="w-[130px] text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {products.map((p) => {
                          const max = Math.max(p.reorderLevel * 2, p.stock, 1)
                          const pct = Math.min(100, (p.stock / max) * 100)
                          const out = p.stock <= 0
                          const low = !out && p.stock <= p.reorderLevel
                          return (
                            <TableRow key={p.id}>
                              <TableCell className="font-mono text-xs whitespace-nowrap">{p.sku}</TableCell>
                              <TableCell>
                                <div className="font-medium leading-tight max-w-[220px] truncate" title={p.name}>
                                  {p.name}
                                </div>
                                {p.category && (
                                  <div className="text-[11px] text-muted-foreground">{p.category.name}</div>
                                )}
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                <div className="flex items-center gap-2 min-w-[160px]">
                                  <span
                                    className={`text-sm tabular-nums w-16 text-right ${
                                      out
                                        ? 'text-red-600 dark:text-red-400 font-semibold'
                                        : low
                                          ? 'text-amber-600 dark:text-amber-400 font-semibold'
                                          : ''
                                    }`}
                                  >
                                    {fmtQty(p.stock)} {p.unit}
                                  </span>
                                  <Progress
                                    value={pct}
                                    aria-label={`Stock level for ${p.name}`}
                                    className={cn(
                                      'h-2 flex-1',
                                      out ? '[&>div]:bg-red-500' : low ? '[&>div]:bg-amber-500' : '[&>div]:bg-emerald-500'
                                    )}
                                  />
                                </div>
                                <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2">
                                  <span>min {fmtQty(p.reorderLevel)}</span>
                                  <CoverBadge product={p} />
                                </div>
                              </TableCell>
                              <TableCell className="text-right tabular-nums whitespace-nowrap">
                                {fmtMoney(p.stock * p.costPrice)}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="inline-flex items-center gap-1">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8"
                                    aria-label={`Receive stock for ${p.name}`}
                                    onClick={() => openAdjust(p.id, 'PURCHASE')}
                                  >
                                    <PackagePlus className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                                    Receive
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-8"
                                    aria-label={`Adjust stock for ${p.name}`}
                                    onClick={() => openAdjust(p.id, 'ADJUST')}
                                  >
                                    <SlidersHorizontal className="size-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </Card>
            )}

            {/* ── Low stock ── */}
            {tab === 'low' && (
              <Card className="overflow-hidden">
                {lowStockProducts.length === 0 ? (
                  <EmptyState
                    icon={PackagePlus}
                    title="All stocked up"
                    message="No products are at or below their reorder level."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <Table className="min-w-[720px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[120px]">SKU</TableHead>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-right">Stock / min</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-[130px] text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lowStockProducts.map((p) => {
                          const out = p.stock <= 0
                          return (
                            <TableRow key={p.id}>
                              <TableCell className="font-mono text-xs whitespace-nowrap">{p.sku}</TableCell>
                              <TableCell>
                                <div className="font-medium leading-tight max-w-[240px] truncate" title={p.name}>
                                  {p.name}
                                </div>
                                {p.category && (
                                  <div className="text-[11px] text-muted-foreground">{p.category.name}</div>
                                )}
                              </TableCell>
                              <TableCell className="text-right tabular-nums whitespace-nowrap">
                                <span
                                  className={`font-semibold ${
                                    out ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'
                                  }`}
                                >
                                  {fmtQty(p.stock)}
                                </span>
                                <span className="text-muted-foreground"> / {fmtQty(p.reorderLevel)}</span>
                              </TableCell>
                              <TableCell>
                                {out ? (
                                  <Badge className="bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/30" variant="outline">
                                    Out of stock
                                  </Badge>
                                ) : (
                                  <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30" variant="outline">
                                    Low
                                  </Badge>
                                )}
                                <CoverBadge product={p} className="ml-2" />
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8"
                                  disabled={restockId === p.id}
                                  aria-label={`Receive 10 ${p.unit} of ${p.name}`}
                                  onClick={() => quickRestock(p)}
                                >
                                  <PackagePlus className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                                  Receive 10
                                </Button>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </Card>
            )}

            {/* ── Movement ledger ── */}
            {tab === 'ledger' && (
              <Card className="overflow-hidden">
                <div className="flex flex-wrap items-center gap-2.5 p-3 sm:p-4 border-b">
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger className="w-[140px] h-9" aria-label="Filter by movement type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      <SelectItem value="PURCHASE">Receive</SelectItem>
                      <SelectItem value="SALE">Sale</SelectItem>
                      <SelectItem value="ADJUST">Adjust</SelectItem>
                      <SelectItem value="DAMAGE">Damage</SelectItem>
                      <SelectItem value="RETURN">Return</SelectItem>
                      <SelectItem value="REFUND">Refund</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="date"
                    value={from}
                    max={to}
                    onChange={(e) => setFrom(e.target.value)}
                    className="w-[150px] h-9"
                    aria-label="From date"
                  />
                  <Input
                    type="date"
                    value={to}
                    min={from}
                    onChange={(e) => setTo(e.target.value)}
                    className="w-[150px] h-9"
                    aria-label="To date"
                  />
                  <Input
                    value={ledgerSearch}
                    onChange={(e) => setLedgerSearch(e.target.value)}
                    placeholder="Filter by product…"
                    className="w-full sm:w-[200px] h-9 sm:ml-auto"
                    aria-label="Search movements by product"
                  />
                </div>

                {movementsQ.error && !movementsQ.data ? (
                  <div className="p-4">
                    <ErrorState message={movementsQ.error} onRetry={movementsQ.refetch} />
                  </div>
                ) : shownMovements.length === 0 ? (
                  <EmptyState
                    icon={Warehouse}
                    title="No movements found"
                    message="Try widening the date range or clearing filters."
                  />
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <Table className="min-w-[880px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[160px]">Date</TableHead>
                            <TableHead>Product</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead className="text-right">Qty</TableHead>
                            <TableHead className="hidden md:table-cell">Reference</TableHead>
                            <TableHead className="hidden lg:table-cell">Note</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {shownMovements.map((m) => {
                            const positive = m.qty > 0
                            return (
                              <TableRow key={m.id}>
                                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                  {fmtDateTime(m.createdAt)}
                                </TableCell>
                                <TableCell>
                                  <div className="font-medium leading-tight max-w-[220px] truncate" title={m.product?.name}>
                                    {m.product?.name ?? '—'}
                                  </div>
                                  <div className="font-mono text-[11px] text-muted-foreground">{m.product?.sku}</div>
                                </TableCell>
                                <TableCell>
                                  <MovementBadge type={m.type} />
                                </TableCell>
                                <TableCell className="text-right whitespace-nowrap">
                                  <span
                                    className={`font-semibold tabular-nums ${
                                      positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                                    }`}
                                  >
                                    {positive ? '+' : ''}
                                    {fmtQty(m.qty)}
                                  </span>
                                  <span className="ml-2 text-[11px] text-muted-foreground tabular-nums">
                                    {fmtQty(m.before)} → {fmtQty(m.after)}
                                  </span>
                                </TableCell>
                                <TableCell className="hidden md:table-cell font-mono text-xs text-muted-foreground">
                                  {m.reference || '—'}
                                </TableCell>
                                <TableCell className="hidden lg:table-cell text-xs text-muted-foreground max-w-[220px] truncate">
                                  {m.note || '—'}
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="flex items-center justify-between gap-3 p-3 border-t">
                      <p className="text-xs text-muted-foreground">
                        Showing {shownMovements.length} of {filteredMovements.length} movements
                      </p>
                      {visible < filteredMovements.length && (
                        <Button variant="outline" size="sm" onClick={() => setVisible((v) => v + LEDGER_PAGE)}>
                          Load more
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </Card>
            )}
          </Tabs>
        </>
      )}

      <AdjustDialog
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        products={products}
        initialProductId={adjustProductId}
        initialType={adjustType}
        onDone={() => {
          productsQ.refetch()
          movementsQ.refetch()
        }}
      />
    </div>
  )
}
