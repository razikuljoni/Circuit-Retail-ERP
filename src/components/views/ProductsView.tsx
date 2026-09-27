'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  Archive,
  ArchiveRestore,
  Download,
  Package,
  PackageSearch,
  Pencil,
  Plus,
  Printer,
  Tags,
  Upload,
} from 'lucide-react'
import { api, qs } from '@/lib/api'
import { fmtMoney, fmtNum, fmtQty } from '@/lib/format'
import type { Category, Product, Supplier } from '@/lib/types'
import { useApi } from '@/hooks/use-api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { PageHeader, EmptyState, ErrorState, ViewLoader } from '@/components/shared/page-bits'
import { StatCard } from '@/components/shared/stat-card'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { hashColor } from './products/colors'
import { ProductAvatar } from '@/components/shared/product-avatar'
import { downloadProductsCsv } from './products/csv'
import { useDebouncedValue } from './products/use-debounced-value'
import { ProductDialog } from './products/product-dialog'
import { LabelSheet } from './products/label-sheet'
import { BulkLabelSheet } from './products/bulk-label-sheet'
import { ImportDialog } from './products/import-dialog'
import { ProductDetailDrawer } from './products/product-detail-drawer'

type Quick = 'all' | 'low' | 'out'
type SortKey = 'name' | 'stock' | 'price'
type StatusKey = 'active' | 'inactive' | 'all'

function stockTone(p: Product): { cls: string; label: string } {
  if (p.stock <= 0) return { cls: 'text-red-600 dark:text-red-400 font-semibold', label: 'out' }
  if (p.stock <= p.reorderLevel) return { cls: 'text-amber-600 dark:text-amber-400 font-semibold', label: 'low' }
  return { cls: '', label: 'ok' }
}

/** Profit margin badge — green at healthy markup, amber/red as it thins out. */
function MarginBadge({ price, cost }: { price: number; cost: number }) {
  if (price <= 0) return <span className="text-muted-foreground text-sm">—</span>
  const margin = ((price - cost) / price) * 100
  const cls =
    margin >= 25
      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
      : margin >= 10
        ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400'
        : 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400'
  return (
    <Badge variant="outline" className={cls} title={`Cost ${fmtMoney(cost)} → Price ${fmtMoney(price)}`}>
      <span className="tabular-nums">{margin.toFixed(0)}%</span>
    </Badge>
  )
}

export default function ProductsView() {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const [categoryId, setCategoryId] = useState('all')
  const [supplierId, setSupplierId] = useState('all')
  const [status, setStatus] = useState<StatusKey>('active')
  const [quick, setQuick] = useState<Quick>('all')
  const [sort, setSort] = useState<SortKey>('name')

  const url =
    '/api/products' +
    qs({
      search: debouncedSearch,
      categoryId: categoryId === 'all' ? undefined : categoryId,
      supplierId: supplierId === 'all' ? undefined : supplierId,
      status,
      lowStock: quick === 'low' ? 1 : undefined,
      outOfStock: quick === 'out' ? 1 : undefined,
      sort,
      limit: 500,
    })
  const { data, loading, error, refetch } = useApi<Product[]>(url)
  const { data: categories, refetch: refetchCategories } = useApi<Category[]>('/api/categories')
  const { data: suppliers } = useApi<Supplier[]>('/api/suppliers')

  const products = data ?? []

  // Bulk selection: Set of product ids the user ticked. Multi-select exists for
  // the bulk label sheet; derived against the CURRENT list so counts/dialog
  // always match what is visible (ids filtered out of the view simply idle in
  // the set until ticked again or cleared — no phantom rows anywhere).
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const selectedVisible = useMemo(
    () => products.filter((p) => selectedIds.has(p.id)),
    [products, selectedIds],
  )

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAllVisible() {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      const allSelected = products.length > 0 && products.every((p) => next.has(p.id))
      for (const p of products) {
        if (allSelected) next.delete(p.id)
        else next.add(p.id)
      }
      return next
    })
  }

  function clearSelection() {
    setSelectedIds(new Set())
  }

  // Keyboard detail: Escape clears the selection — but only when nothing else
  // is claiming it (no dialog/sheet open, not typing in a form field).
  const hasSelection = selectedVisible.length > 0
  useEffect(() => {
    if (!hasSelection) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (document.querySelector('[role=dialog], [data-slot=sheet-content]')) return
      const el = document.activeElement
      const tag = el?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (el as HTMLElement | null)?.isContentEditable) return
      clearSelection()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hasSelection])

  const allVisibleSelected = products.length > 0 && products.every((p) => selectedIds.has(p.id))
  const someVisibleSelected = products.some((p) => selectedIds.has(p.id))

  const stats = useMemo(() => {
    let costValue = 0
    let retailValue = 0
    let low = 0
    let out = 0
    for (const p of products) {
      costValue += p.stock * p.costPrice
      retailValue += p.stock * p.price
      if (p.stock <= 0) out++
      else if (p.stock <= p.reorderLevel) low++
    }
    return { count: products.length, costValue, retailValue, low, out }
  }, [products])

  // Dialog + confirm state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<Product | null>(null)
  const [archivePending, setArchivePending] = useState(false)
  const [labelTarget, setLabelTarget] = useState<Product | null>(null)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)

  function openCreate() {
    setEditing(null)
    setDialogOpen(true)
  }
  function openEdit(p: Product) {
    setEditing(p)
    setDialogOpen(true)
  }

  async function confirmArchive() {
    if (!archiveTarget) return
    setArchivePending(true)
    try {
      await api.del(`/api/products/${archiveTarget.id}`)
      toast.success(`"${archiveTarget.name}" archived`)
      setArchiveTarget(null)
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to archive product')
    } finally {
      setArchivePending(false)
    }
  }

  async function restore(p: Product) {
    setRestoringId(p.id)
    try {
      await api.put(`/api/products/${p.id}`, { isActive: true })
      toast.success(`"${p.name}" restored`)
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to restore product')
    } finally {
      setRestoringId(null)
    }
  }

  const showSkeleton = loading && !data
  if (showSkeleton) return <ViewLoader />

  return (
    <div className={selectedVisible.length > 0 ? 'pb-16 transition-[padding] duration-200' : 'transition-[padding] duration-200'}>
      <PageHeader
        icon={Package}
        title="Products"
        subtitle="Catalog, pricing and stock levels"
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => downloadProductsCsv(products)}
              disabled={products.length === 0}
            >
              <Download className="size-4" />
              <span className="hidden sm:inline">Export CSV</span>
              <span className="sm:hidden">CSV</span>
            </Button>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="size-4" />
              <span className="hidden sm:inline">Import</span>
            </Button>
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              Add product
            </Button>
          </>
        }
      />

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => {
          refetch()
          refetchCategories()
        }}
      />

      {error && !data ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : (
        <>
          {/* Stat chips */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
            <StatCard title="Products" value={fmtNum(stats.count)} icon={Package} />
            <StatCard
              title="Stock value (cost)"
              value={fmtMoney(stats.costValue, { compact: true })}
              icon={Package}
              iconClassName="bg-emerald-500/10 [&_svg]:text-emerald-600 dark:[&_svg]:text-emerald-400"
            />
            <StatCard
              title="Retail value"
              value={fmtMoney(stats.retailValue, { compact: true })}
              icon={Package}
              iconClassName="bg-teal-500/10 [&_svg]:text-teal-600 dark:[&_svg]:text-teal-400"
            />
            <StatCard
              title="Low stock"
              value={fmtNum(stats.low)}
              icon={PackageSearch}
              iconClassName="bg-amber-500/10 [&_svg]:text-amber-600 dark:[&_svg]:text-amber-400"
            />
            <StatCard
              title="Out of stock"
              value={fmtNum(stats.out)}
              icon={PackageSearch}
              iconClassName="bg-red-500/10 [&_svg]:text-red-600 dark:[&_svg]:text-red-400"
            />
          </div>

          {/* Filter toolbar */}
          <Card className="p-3 sm:p-4 mb-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, SKU, barcode…"
                  className="pl-8 h-9"
                  aria-label="Search products"
                />
                <PackageSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" aria-hidden />
              </div>

              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="w-[150px] h-9" aria-label="Filter by category">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {(categories ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger className="w-[150px] h-9" aria-label="Filter by supplier">
                  <SelectValue placeholder="Supplier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All suppliers</SelectItem>
                  {(suppliers ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={status} onValueChange={(v) => setStatus(v as StatusKey)}>
                <SelectTrigger className="w-[120px] h-9" aria-label="Filter by status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Archived</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>

              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                value={quick}
                onValueChange={(v) => {
                  if (v) setQuick(v as Quick)
                }}
                aria-label="Stock quick filter"
              >
                <ToggleGroupItem value="all" className="h-9">
                  All
                </ToggleGroupItem>
                <ToggleGroupItem value="low" className="h-9">
                  Low stock
                </ToggleGroupItem>
                <ToggleGroupItem value="out" className="h-9">
                  Out
                </ToggleGroupItem>
              </ToggleGroup>

              <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
                <SelectTrigger className="w-[130px] h-9 ml-auto" aria-label="Sort products">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Sort: Name</SelectItem>
                  <SelectItem value="stock">Sort: Stock</SelectItem>
                  <SelectItem value="price">Sort: Price</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Card>

          {/* Table */}
          <Card className="overflow-hidden">
            {products.length === 0 ? (
              <EmptyState
                icon={Package}
                title="No products found"
                message={
                  search || categoryId !== 'all' || supplierId !== 'all' || quick !== 'all'
                    ? 'Try adjusting the filters or search.'
                    : 'Add your first product to start tracking stock and sales.'
                }
                action={
                  <Button onClick={openCreate} size="sm">
                    <Plus className="size-4" /> Add product
                  </Button>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[960px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-9 pr-0">
                        <Checkbox
                          checked={allVisibleSelected ? true : someVisibleSelected ? 'indeterminate' : false}
                          onCheckedChange={toggleAllVisible}
                          aria-label={allVisibleSelected ? 'Clear all selected products' : 'Select all visible products'}
                        />
                      </TableHead>
                      <TableHead className="w-[130px]">SKU</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead className="hidden md:table-cell">Category</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="hidden xl:table-cell text-right">Margin</TableHead>
                      <TableHead className="hidden sm:table-cell text-right">Tax</TableHead>
                      <TableHead className="text-right">Stock</TableHead>
                      <TableHead className="hidden lg:table-cell">Status</TableHead>
                      <TableHead className="w-[92px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((p) => {
                      const tone = stockTone(p)
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="w-9 pr-0">
                            <Checkbox
                              checked={selectedIds.has(p.id)}
                              onCheckedChange={() => toggleSelected(p.id)}
                              aria-label={`Select ${p.name}`}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-xs whitespace-nowrap">{p.sku}</TableCell>
                          <TableCell>
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 rounded-md text-left transition-colors outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                              aria-label={`View details for ${p.name}`}
                              onClick={() => setDetailId(p.id)}
                            >
                              <ProductAvatar
                                name={p.name}
                                sku={p.sku}
                                imageUrl={p.imageUrl}
                                className="size-8 rounded-md"
                                textClassName="text-[11px]"
                              />
                              <div className="min-w-0">
                                <div className="font-medium leading-tight max-w-[240px] truncate" title={p.name}>
                                  {p.name}
                                </div>
                                {p.barcode && (
                                  <div className="font-mono text-[11px] text-muted-foreground">{p.barcode}</div>
                                )}
                              </div>
                            </button>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {p.category ? (
                              <span className="inline-flex items-center gap-1.5 text-sm">
                                <span
                                  className="size-2 rounded-full shrink-0"
                                  style={{ backgroundColor: p.category.color ?? hashColor(p.category.name) }}
                                  aria-hidden
                                />
                                {p.category.name}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            <div className="font-semibold tabular-nums">{fmtMoney(p.price)}</div>
                            <div className="text-[11px] text-muted-foreground tabular-nums">{fmtMoney(p.costPrice)}</div>
                          </TableCell>
                          <TableCell className="hidden xl:table-cell text-right">
                            <MarginBadge price={p.price} cost={p.costPrice} />
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-right tabular-nums text-muted-foreground">
                            {p.taxRate}%
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            <span className={`tabular-nums ${tone.cls}`}>
                              {fmtQty(p.stock)} {p.unit}
                            </span>
                            <div className="text-[11px] text-muted-foreground tabular-nums">min {fmtQty(p.reorderLevel)}</div>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            {p.isActive ? (
                              <Badge variant="secondary">Active</Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground">
                                Archived
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                aria-label={`Edit ${p.name}`}
                                onClick={() => openEdit(p)}
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                aria-label={`Print barcode label for ${p.name}`}
                                onClick={() => setLabelTarget(p)}
                              >
                                <Tags className="size-3.5" />
                              </Button>
                              {p.isActive ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 text-muted-foreground hover:text-destructive"
                                  aria-label={`Archive ${p.name}`}
                                  onClick={() => setArchiveTarget(p)}
                                >
                                  <Archive className="size-3.5" />
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 text-muted-foreground hover:text-emerald-600"
                                  aria-label={`Restore ${p.name}`}
                                  disabled={restoringId === p.id}
                                  onClick={() => restore(p)}
                                >
                                  <ArchiveRestore className="size-3.5" />
                                </Button>
                              )}
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
        </>
      )}

      <ProductDetailDrawer
        productId={detailId}
        onOpenChange={(o) => !o && setDetailId(null)}
        onEdit={(p) => {
          setDetailId(null)
          openEdit(p)
        }}
        onPrintLabel={(p) => {
          setDetailId(null)
          setLabelTarget(p)
        }}
      />

      {labelTarget && (
        <LabelSheet
          product={labelTarget}
          open={labelTarget !== null}
          onOpenChange={(o) => {
            if (!o) setLabelTarget(null)
          }}
        />
      )}

      {bulkOpen && selectedVisible.length > 0 && (
        <BulkLabelSheet
          products={selectedVisible}
          open={bulkOpen}
          onOpenChange={setBulkOpen}
        />
      )}

      <ProductDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        product={editing}
        categories={categories ?? []}
        suppliers={suppliers ?? []}
        onSaved={() => {
          refetch()
          refetchCategories()
        }}
      />

      <ConfirmDialog
        open={archiveTarget !== null}
        onOpenChange={(o) => !o && setArchiveTarget(null)}
        title="Archive product?"
        message={`"${archiveTarget?.name ?? ''}" will be hidden from POS and product lists. Historical sales are kept. You can restore it later.`}
        confirmLabel="Archive"
        pending={archivePending}
        onConfirm={confirmArchive}
      />

      {/* Floating bulk action bar — only while a selection exists. The root
          div gains pb-16 so the bar never covers the last rows / footer. */}
      {selectedVisible.length > 0 && (
        <div
          role="toolbar"
          aria-label="Bulk selection actions"
          className="fixed bottom-3 left-1/2 z-50 flex max-w-[calc(100vw-1.5rem)] -translate-x-1/2 items-center gap-1.5 rounded-full border bg-card/95 py-1.5 pl-4 pr-1.5 shadow-lg backdrop-blur animate-in fade-in slide-in-from-bottom-4 duration-300 sm:bottom-4 sm:gap-2"
        >
          <span
            aria-live="polite"
            title="Press Escape to clear the selection"
            className="inline-flex items-center whitespace-nowrap rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary tabular-nums"
          >
            {selectedVisible.length} selected
          </span>
          <Button
            size="sm"
            onClick={() => setBulkOpen(true)}
            aria-label={`Print labels for ${selectedVisible.length} selected products`}
          >
            <Printer className="size-4" aria-hidden />
            Print labels
          </Button>
          <Button variant="ghost" size="sm" onClick={clearSelection} aria-label="Clear selection">
            Clear
          </Button>
        </div>
      )}
    </div>
  )
}
