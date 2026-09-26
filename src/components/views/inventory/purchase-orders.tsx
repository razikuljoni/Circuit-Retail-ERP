'use client'

// ── Purchase orders panel: list + builder dialog + receive workflow ──────────
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  CheckCircle2,
  ClipboardList,
  PackageCheck,
  PackageOpen,
  Plus,
  Send,
  ShoppingCart,
  Trash2,
  TruckIcon,
  Wand2,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/shared/page-bits'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { Spinner } from '@/components/shared/page-bits'
import { ReceiveDialog } from './receive-dialog'
import { api } from '@/lib/api'
import { fmtDate, fmtMoney, fmtQty } from '@/lib/format'
import type { Product, PurchaseOrder, Supplier } from '@/lib/types'

// ── Status badge ─────────────────────────────────────────────────────────────

export function PoStatusBadge({ status }: { status: PurchaseOrder['status'] }) {
  const map: Record<string, string> = {
    DRAFT: 'bg-muted text-muted-foreground border-border',
    ORDERED: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30',
    PARTIAL: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/30',
    RECEIVED: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
    CANCELLED: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30',
  }
  return (
    <Badge variant="outline" className={`text-[11px] font-semibold ${map[status] ?? map.DRAFT}`}>
      {status}
    </Badge>
  )
}

// ── Panel ────────────────────────────────────────────────────────────────────

interface PoRow extends PurchaseOrder {
  totalCost?: number
}

export function PurchaseOrdersPanel({
  products,
  onDataChanged,
}: {
  products: Product[]
  onDataChanged: () => void
}) {
  const [orders, setOrders] = useState<PoRow[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [builderOpen, setBuilderOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<PoRow | null>(null)
  const [receiveTarget, setReceiveTarget] = useState<PoRow | null>(null)

  const suppliers = useMemo<Supplier[]>(() => {
    const map = new Map<string, Supplier>()
    for (const p of products) {
      if (p.supplier && p.supplierId && !map.has(p.supplierId)) map.set(p.supplierId, p.supplier)
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [products])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<{ orders: PoRow[] }>('/api/purchase-orders?limit=100')
      setOrders(res.orders)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load purchase orders')
    } finally {
      setLoading(false)
    }
  }

  // Load on mount (panel remounts each time the tab is opened)
  useEffect(() => {
    void load()
  }, [])

  const refreshAll = () => {
    void load()
    onDataChanged()
  }

  async function markOrdered(po: PoRow) {
    setBusyId(po.id)
    try {
      await api.put(`/api/purchase-orders/${po.id}`, { status: 'ORDERED' })
      toast.success(`${po.poNo} marked as ordered`)
      refreshAll()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update purchase order')
    } finally {
      setBusyId(null)
    }
  }

  async function cancelPo(po: PoRow) {
    setBusyId(po.id)
    try {
      await api.put(`/api/purchase-orders/${po.id}`, { status: 'CANCELLED' })
      toast.success(`${po.poNo} cancelled`)
      refreshAll()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to cancel purchase order')
    } finally {
      setBusyId(null)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setBusyId(deleteTarget.id)
    try {
      await api.del(`/api/purchase-orders/${deleteTarget.id}`)
      toast.success(`${deleteTarget.poNo} deleted`)
      setDeleteTarget(null)
      refreshAll()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete purchase order')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 sm:p-4 border-b">
          <p className="text-sm text-muted-foreground">
            Raise restock orders per supplier, then receive them into stock in one tap.
          </p>
          <Button size="sm" className="h-9" onClick={() => setBuilderOpen(true)}>
            <Plus className="size-4" /> New purchase order
          </Button>
        </div>

        {loading && !orders ? (
          <div className="flex items-center justify-center py-12">
            <Spinner className="size-5 text-muted-foreground" />
          </div>
        ) : error ? (
          <EmptyState icon={ClipboardList} title="Could not load purchase orders" message={error} />
        ) : (orders ?? []).length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title="No purchase orders yet"
            message="Create one from the low-stock list — suggested quantities are filled in for you."
            action={
              <Button size="sm" onClick={() => setBuilderOpen(true)}>
                <Plus className="size-4" /> New purchase order
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[960px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">PO #</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-center">Items</TableHead>
                  <TableHead className="hidden sm:table-cell">Received</TableHead>
                  <TableHead className="text-right">Order cost</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Created</TableHead>
                  <TableHead className="text-right pr-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(orders ?? []).map((po) => (
                  <TableRow key={po.id}>
                    <TableCell className="pl-4 font-mono text-xs font-semibold whitespace-nowrap">
                      {po.poNo}
                    </TableCell>
                    <TableCell className="text-sm">
                      {po.supplier?.name ?? <span className="text-muted-foreground">Any supplier</span>}
                    </TableCell>
                    <TableCell className="text-center text-sm tabular-nums">{po.items.length}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <ReceivedCell items={po.items} status={po.status} />
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold tabular-nums whitespace-nowrap">
                      {fmtMoney(po.totalCost ?? 0)}
                    </TableCell>
                    <TableCell>
                      <PoStatusBadge status={po.status} />
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground whitespace-nowrap">
                      {fmtDate(po.createdAt)}
                      {po.receivedAt && <span className="block text-[11px]">Received {fmtDate(po.receivedAt)}</span>}
                    </TableCell>
                    <TableCell className="pr-4">
                      <div className="flex items-center justify-end gap-1.5">
                        {po.status === 'DRAFT' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8"
                            disabled={busyId === po.id}
                            onClick={() => void markOrdered(po)}
                          >
                            <Send className="size-3.5 text-amber-600 dark:text-amber-400" /> Mark ordered
                          </Button>
                        )}
                        {(po.status === 'DRAFT' || po.status === 'ORDERED' || po.status === 'PARTIAL') && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 border-emerald-500/40 hover:bg-emerald-500/10"
                            disabled={busyId === po.id}
                            onClick={() => setReceiveTarget(po)}
                          >
                            <PackageCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                            {po.status === 'PARTIAL' ? 'Receive rest' : 'Receive'}
                          </Button>
                        )}
                        {(po.status === 'DRAFT' || po.status === 'ORDERED' || po.status === 'PARTIAL') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-destructive"
                            aria-label={`Cancel ${po.poNo}`}
                            disabled={busyId === po.id}
                            onClick={() => void cancelPo(po)}
                          >
                            <X className="size-4" />
                          </Button>
                        )}
                        {(po.status === 'DRAFT' || po.status === 'CANCELLED') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-destructive"
                            aria-label={`Delete ${po.poNo}`}
                            disabled={busyId === po.id}
                            onClick={() => setDeleteTarget(po)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <PoBuilderDialog
        open={builderOpen}
        onOpenChange={setBuilderOpen}
        products={products}
        suppliers={suppliers}
        onCreated={refreshAll}
      />

      <ReceiveDialog
        po={receiveTarget}
        open={receiveTarget !== null}
        onOpenChange={(o) => !o && setReceiveTarget(null)}
        onReceived={() => refreshAll()}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete purchase order?"
        message={`"${deleteTarget?.poNo ?? ''}" and its ${deleteTarget?.items.length ?? 0} line item(s) will be permanently removed.`}
        confirmLabel="Delete"
        pending={busyId === deleteTarget?.id}
        onConfirm={confirmDelete}
      />
    </>
  )
}

// ── Received progress cell ──────────────────────────────────────────

function ReceivedCell({
  items,
  status,
}: {
  items: PurchaseOrder['items']
  status: PurchaseOrder['status']
}) {
  const ordered = items.reduce((s, it) => s + it.qty, 0)
  const received = items.reduce((s, it) => s + (it.receivedQty ?? 0), 0)
  const pct = Math.min(100, Math.round((received / Math.max(1, ordered)) * 100))
  if (status === 'CANCELLED' && received === 0) {
    return <span className="text-xs text-muted-foreground">—</span>
  }
  return (
    <div className="min-w-24 max-w-32" title={`${fmtQty(received)} of ${fmtQty(ordered)} units received`}>
      <div className="mb-1 flex items-baseline justify-between text-[11px] tabular-nums">
        <span className={pctTone(pct)}>{pct}%</span>
        <span className="text-muted-foreground">
          {fmtQty(received)}/{fmtQty(ordered)}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={progressTone(pct)}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="PO receive progress"
        />
      </div>
    </div>
  )
}

function pctTone(pct: number): string {
  if (pct >= 100) return 'font-semibold text-emerald-600 dark:text-emerald-400'
  if (pct > 0) return 'font-semibold text-amber-600 dark:text-amber-400'
  return 'font-semibold text-muted-foreground'
}

function progressTone(pct: number): string {
  if (pct >= 100) return 'h-full rounded-full bg-emerald-500 transition-all'
  if (pct > 0) return 'h-full rounded-full bg-amber-500 transition-all'
  return 'h-full rounded-full bg-transparent'
}

// ── Builder dialog ───────────────────────────────────────────────────────────

interface DraftLine {
  productId: string
  qty: number
  unitCost: number
}

function PoBuilderDialog({
  open,
  onOpenChange,
  products,
  suppliers,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  products: Product[]
  suppliers: Supplier[]
  onCreated: () => void
}) {
  const [supplierId, setSupplierId] = useState<string>('all')
  const [lines, setLines] = useState<DraftLine[]>([])
  const [note, setNote] = useState('')
  const [savePending, setSavePending] = useState(false)

  const lowStock = useMemo(
    () => products.filter((p) => p.stock <= p.reorderLevel).sort((a, b) => a.stock - b.stock),
    [products]
  )

  const supplierProducts = useMemo(() => {
    if (supplierId === 'all') return products
    return products.filter((p) => p.supplierId === supplierId)
  }, [products, supplierId])

  const totalCost = lines.reduce((s, l) => s + l.qty * l.unitCost, 0)

  function addLine(p: Product) {
    setLines((prev) => {
      if (prev.some((l) => l.productId === p.id)) return prev
      // Suggested qty: cover ~2× reorder level, at least 10 units
      const suggested = Math.max(Math.ceil(p.reorderLevel * 2 - p.stock), 10)
      return [...prev, { productId: p.id, qty: suggested, unitCost: p.costPrice }]
    })
  }

  function fillFromLowStock() {
    const pool = supplierId === 'all' ? lowStock : lowStock.filter((p) => p.supplierId === supplierId)
    if (pool.length === 0) {
      toast.info(supplierId === 'all' ? 'No low-stock products' : 'No low-stock products for this supplier')
      return
    }
    setLines(() =>
      pool.map((p) => ({
        productId: p.id,
        qty: Math.max(Math.ceil(p.reorderLevel * 2 - p.stock), 10),
        unitCost: p.costPrice,
      }))
    )
    toast.success(`${pool.length} low-stock item${pool.length === 1 ? '' : 's'} added with suggested quantities`)
  }

  function reset() {
    setLines([])
    setNote('')
    setSupplierId('all')
  }

  async function save(status: 'DRAFT' | 'ORDERED') {
    if (lines.length === 0) return
    setSavePending(true)
    try {
      const po = await api.post<PurchaseOrder>('/api/purchase-orders', {
        supplierId: supplierId === 'all' ? null : supplierId,
        note: note.trim() || null,
        status,
        items: lines.map((l) => ({ productId: l.productId, qty: l.qty, unitCost: l.unitCost })),
      })
      toast.success(`Purchase order ${po.poNo} ${status === 'DRAFT' ? 'saved as draft' : 'placed'}`, {
        description: `${po.items.length} item${po.items.length === 1 ? '' : 's'} · ${fmtMoney(po.items.reduce((s, i) => s + i.qty * i.unitCost, 0))}`,
      })
      reset()
      onOpenChange(false)
      onCreated()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create purchase order')
    } finally {
      setSavePending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o) }}>
      <DialogContent className="max-w-2xl gap-4" aria-describedby={undefined}>
        {open && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <TruckIcon className="size-4 text-primary" aria-hidden /> New purchase order
              </DialogTitle>
              <DialogDescription className="text-xs">
                Pick a supplier (optional), then add products — "Fill from low stock" drafts everything at once.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-wrap items-center gap-2">
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger className="h-9 w-full sm:w-56 text-xs" aria-label="Supplier">
                  <SelectValue placeholder="Any supplier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any supplier</SelectItem>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="h-9" onClick={fillFromLowStock}>
                <Wand2 className="size-3.5 text-violet-600 dark:text-violet-400" /> Fill from low stock
              </Button>
              <PoProductPicker products={supplierProducts} onPick={addLine} pickedIds={new Set(lines.map((l) => l.productId))} />
            </div>

            {/* Lines */}
            {lines.length === 0 ? (
              <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                No items yet — add products or use "Fill from low stock".
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-3">Product</TableHead>
                      <TableHead className="w-24 text-right">Qty</TableHead>
                      <TableHead className="w-28 text-right">Unit cost</TableHead>
                      <TableHead className="w-28 text-right">Line</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((l) => {
                      const p = products.find((x) => x.id === l.productId)
                      return (
                        <TableRow key={l.productId}>
                          <TableCell className="pl-3">
                            <div className="text-sm font-medium leading-tight max-w-[260px] truncate" title={p?.name}>
                              {p?.name ?? '—'}
                            </div>
                            <div className="font-mono text-[11px] text-muted-foreground">
                              {p?.sku} · stock {fmtQty(p?.stock ?? 0)}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              min={1}
                              value={l.qty}
                              aria-label={`Quantity for ${p?.name}`}
                              className="h-8 w-20 text-right text-xs tabular-nums"
                              onChange={(e) =>
                                setLines((prev) =>
                                  prev.map((x) =>
                                    x.productId === l.productId
                                      ? { ...x, qty: Math.max(1, Math.floor(Number(e.target.value) || 1)) }
                                      : x
                                  )
                                )
                              }
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              min={0}
                              step={0.5}
                              value={l.unitCost}
                              aria-label={`Unit cost for ${p?.name}`}
                              className="h-8 w-24 text-right text-xs tabular-nums"
                              onChange={(e) =>
                                setLines((prev) =>
                                  prev.map((x) =>
                                    x.productId === l.productId
                                      ? { ...x, unitCost: Math.max(0, Number(e.target.value) || 0) }
                                      : x
                                  )
                                )
                              }
                            />
                          </TableCell>
                          <TableCell className="text-right text-sm font-semibold tabular-nums">
                            {fmtMoney(l.qty * l.unitCost)}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-muted-foreground hover:text-destructive"
                              aria-label={`Remove ${p?.name}`}
                              onClick={() => setLines((prev) => prev.filter((x) => x.productId !== l.productId))}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note for this order (optional) — delivery instructions, payment terms…"
              rows={2}
              className="text-xs"
              aria-label="Purchase order note"
            />

            <div className="flex items-center justify-between rounded-lg bg-muted/60 px-4 py-2.5">
              <span className="text-xs font-medium text-muted-foreground">
                {lines.length} line item{lines.length === 1 ? '' : 's'}
              </span>
              <span className="text-lg font-bold tabular-nums">{fmtMoney(totalCost)}</span>
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" className="h-10" onClick={() => { reset(); onOpenChange(false) }}>
                Cancel
              </Button>
              <Button
                variant="outline"
                className="h-10"
                disabled={lines.length === 0 || savePending}
                onClick={() => void save('DRAFT')}
              >
                <ClipboardList className="size-4" /> Save draft
              </Button>
              <Button className="h-10" disabled={lines.length === 0 || savePending} onClick={() => void save('ORDERED')}>
                {savePending ? <Spinner className="mr-1.5" /> : <CheckCircle2 className="size-4" />} Place order
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ── Product picker (small search + add) ──────────────────────────────────────

function PoProductPicker({
  products,
  onPick,
  pickedIds,
}: {
  products: Product[]
  onPick: (p: Product) => void
  pickedIds: Set<string>
}) {
  const [q, setQ] = useState('')
  const matches = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) return []
    return products
      .filter(
        (p) =>
          !pickedIds.has(p.id) &&
          (p.name.toLowerCase().includes(query) || p.sku.toLowerCase().includes(query))
      )
      .slice(0, 6)
  }, [products, q, pickedIds])

  return (
    <div className="relative min-w-40 flex-1">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Add product by name / SKU…"
        className="h-9 text-xs"
        aria-label="Add product to purchase order"
      />
      {matches.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-md border bg-popover shadow-md">
          {matches.map((p) => (
            <button
              key={p.id}
              type="button"
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-accent hover:text-accent-foreground"
              onClick={() => {
                onPick(p)
                setQ('')
              }}
            >
              <span className="truncate font-medium">{p.name}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">stock {fmtQty(p.stock)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
