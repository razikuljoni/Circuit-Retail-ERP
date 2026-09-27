'use client'

// ── ProductDetailDrawer — right-side Sheet with 30-day performance stats,
// recent sale lines and stock ledger movements for one product.
// Opened from the products table name cell; also hosts Edit / Print label actions.
import { Pencil, PackageSearch, Tags } from 'lucide-react'
import { fmtDate, fmtDateTime, fmtMoney, fmtNum, fmtQty, fmtTime } from '@/lib/format'
import type { Product, ProductDetail } from '@/lib/types'
import { useApi } from '@/hooks/use-api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet'
import { ProductAvatar } from '@/components/shared/product-avatar'
import { MovementBadge } from '@/components/views/inventory/movement-type'
import { cn } from '@/lib/utils'
import { hashColor } from './colors'

interface Props {
  productId: string | null
  onOpenChange: (o: boolean) => void
  onEdit?: (p: Product) => void
  onPrintLabel?: (p: Product) => void
}

/** Compact relative label for recent activity ("3m ago", "2h ago", "5d ago") */
function relTime(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return fmtDate(iso)
}

function SectionHeader({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{children}</h3>
      {right}
    </div>
  )
}

/** Small pill count used at the right of section headers */
function CountBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
      {children}
    </span>
  )
}

function StatTile({
  label,
  value,
  valueClass,
  hint,
  accent,
}: {
  label: string
  value: React.ReactNode
  valueClass?: string
  hint?: React.ReactNode
  /** Soft background tint for attention states (e.g. restock-soon) */
  accent?: 'amber'
}) {
  return (
    <div
      className={cn(
        'rounded-lg p-3 transition-colors',
        accent === 'amber'
          ? 'border border-amber-500/30 bg-amber-500/[0.07] dark:bg-amber-500/[0.09]'
          : 'bg-muted/50 hover:bg-muted/70'
      )}
    >
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={cn('mt-1 text-base font-semibold tabular-nums', valueClass)}>{value}</div>
      {hint && <div className="mt-0.5 text-[10px] leading-tight">{hint}</div>}
    </div>
  )
}

/** Loading skeleton mirroring the drawer layout */
function DrawerSkeleton() {
  return (
    <div className="flex-1 space-y-5 overflow-hidden p-5" aria-hidden>
      <div className="flex items-start gap-3">
        <Skeleton className="size-14 rounded-xl" />
        <div className="flex-1 space-y-2 pt-1">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
          <div className="flex gap-1.5 pt-1">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[68px] rounded-lg" />
        ))}
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-9 rounded-md" />
        ))}
      </div>
    </div>
  )
}

export function ProductDetailDrawer({ productId, onOpenChange, onEdit, onPrintLabel }: Props) {
  const { data, loading, error, refetch } = useApi<ProductDetail>(
    productId ? `/api/products/${productId}/detail` : null
  )
  const open = productId !== null
  const p = data?.product
  const stats = data?.stats
  const showActions = !!p && !!(onEdit || onPrintLabel)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        {/* Radix-required accessible name/description (visible header is custom) */}
        <SheetTitle className="sr-only">Product details</SheetTitle>
        <SheetDescription className="sr-only">
          30-day sales performance, recent sale lines and stock movement history for this product.
        </SheetDescription>

        {loading || (!data && !error) ? (
          <DrawerSkeleton />
        ) : error && !data ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <PackageSearch className="size-8 text-muted-foreground" aria-hidden />
            <p className="max-w-xs text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={refetch}>
              Retry
            </Button>
          </div>
        ) : p && stats ? (
          <>
            {/* ── Header ── */}
            <div className="border-b p-5 pr-12">
              <div className="flex items-start gap-3">
                <ProductAvatar
                  name={p.name}
                  sku={p.sku}
                  imageUrl={p.imageUrl}
                  className="size-14 rounded-xl"
                  textClassName="text-lg"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-lg font-semibold leading-tight" title={p.name}>
                    {p.name}
                  </div>
                  <div className="mt-0.5 font-mono text-xs text-muted-foreground">
                    {p.sku}
                    {p.barcode ? ` · ${p.barcode}` : ''}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {p.category && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: p.category.color ?? hashColor(p.category.name) }}
                          aria-hidden
                        />
                        {p.category.name}
                      </span>
                    )}
                    {p.isActive ? (
                      <Badge variant="secondary">Active</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Archived
                      </Badge>
                    )}
                    {p.stock <= 0 ? (
                      <Badge
                        variant="outline"
                        className="border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400"
                      >
                        Out
                      </Badge>
                    ) : p.stock <= p.reorderLevel ? (
                      <Badge
                        variant="outline"
                        className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                      >
                        Low
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      >
                        In stock
                      </Badge>
                    )}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {fmtQty(p.stock)} {p.unit} on hand · reorder at {fmtQty(p.reorderLevel)}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Body ── */}
            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              {/* Stats */}
              <div className="grid grid-cols-2 gap-3" aria-label="30-day performance stats">
                <StatTile label="Units sold (30d)" value={fmtQty(stats.unitsSold30d)} />
                <StatTile label="Revenue (30d)" value={fmtMoney(stats.revenue30d)} />
                <StatTile
                  label="Profit (30d)"
                  value={fmtMoney(stats.profit30d)}
                  valueClass={
                    stats.profit30d < 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }
                />
                <StatTile label="Stock value (cost)" value={fmtMoney(stats.stockCostValue)} />
                <StatTile
                  label="Margin %"
                  value={stats.marginPct === null ? '—' : `${fmtNum(stats.marginPct, 1)}%`}
                  valueClass={
                    stats.marginPct === null
                      ? 'text-muted-foreground font-normal'
                      : stats.marginPct >= 25
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : stats.marginPct >= 10
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-red-600 dark:text-red-400'
                  }
                />
                <StatTile
                  label="Days of cover"
                  accent={stats.daysCover !== null && stats.daysCover <= 7 ? 'amber' : undefined}
                  value={
                    stats.daysCover === null ? (
                      <span className="font-normal text-muted-foreground">—</span>
                    ) : (
                      fmtNum(stats.daysCover, 1)
                    )
                  }
                  hint={
                    stats.daysCover !== null && stats.daysCover <= 7 ? (
                      <span className="font-medium text-amber-600 dark:text-amber-400">Restock soon</span>
                    ) : stats.avgDailyQty7d > 0 ? (
                      <span className="text-muted-foreground">≈ {fmtNum(stats.avgDailyQty7d, 2)}/day</span>
                    ) : undefined
                  }
                />
              </div>

              {/* Recent sales */}
              <section className="space-y-2">
                <SectionHeader right={<CountBadge>{data.recentSales.length}</CountBadge>}>
                  Recent sales
                </SectionHeader>
                {data.recentSales.length === 0 ? (
                  <p className="rounded-md bg-muted/40 px-3 py-4 text-center text-xs text-muted-foreground">
                    No sales in the last 30 days
                  </p>
                ) : (
                  <ul className="max-h-64 divide-y divide-border/60 overflow-y-auto py-0.5">
                    {data.recentSales.map((s, i) => (
                      <li
                        key={`${s.saleId}-${i}`}
                        className={cn(
                          'flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors -mx-2 hover:bg-muted/60',
                          s.status === 'REFUNDED' && 'opacity-60'
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-medium">{s.invoiceNo}</span>
                            {s.status === 'REFUNDED' && (
                              <Badge
                                variant="outline"
                                className="h-4 border-red-500/40 bg-red-500/10 px-1 text-[10px] text-red-700 dark:text-red-400"
                              >
                                REFUNDED
                              </Badge>
                            )}
                          </div>
                          <div className="truncate text-[11px] text-muted-foreground">
                            {s.customerName || 'Walk-in'} · {fmtDate(s.createdAt)} {fmtTime(s.createdAt)}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-[11px] text-muted-foreground tabular-nums">
                            {fmtQty(s.qty)} × {fmtMoney(s.unitPrice)}
                          </div>
                          <div className="text-sm font-semibold tabular-nums">{fmtMoney(s.total)}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Stock movements */}
              <section className="space-y-2">
                <SectionHeader right={<CountBadge>{data.movements.length}</CountBadge>}>
                  Stock movements
                </SectionHeader>
                {data.movements.length === 0 ? (
                  <p className="rounded-md bg-muted/40 px-3 py-4 text-center text-xs text-muted-foreground">
                    No stock movements yet — ledger entries will appear here
                  </p>
                ) : (
                  <ul className="max-h-64 divide-y divide-border/60 overflow-y-auto py-0.5">
                    {data.movements.map((m) => (
                      <li
                        key={m.id}
                        className="flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors -mx-2 hover:bg-muted/60"
                      >
                        <MovementBadge type={m.type} className="shrink-0" />
                        <span
                          className={cn(
                            'w-12 shrink-0 text-right text-sm font-semibold tabular-nums',
                            m.qty > 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : m.qty < 0
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-muted-foreground'
                          )}
                        >
                          {m.qty > 0 ? `+${fmtQty(m.qty)}` : fmtQty(m.qty)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="font-mono text-[11px] text-muted-foreground">
                            {fmtQty(m.before)} → {fmtQty(m.after)}
                          </div>
                          {m.reference && (
                            <span className="mt-0.5 inline-block max-w-full truncate rounded bg-muted/60 px-1.5 font-mono text-[10px] leading-4 text-muted-foreground">
                              {m.reference}
                            </span>
                          )}
                        </div>
                        <span
                          className="shrink-0 text-[11px] text-muted-foreground"
                          title={fmtDateTime(m.createdAt)}
                        >
                          {relTime(m.createdAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            {/* ── Footer ── */}
            {showActions && (
              <div className="mt-auto border-t p-5 pt-3">
                {p.supplier && (
                  <div className="mb-3 truncate text-xs text-muted-foreground">
                    Supplier:{' '}
                    <span className="font-medium text-foreground">{p.supplier.name}</span>
                    {p.supplier.phone ? ` · ${p.supplier.phone}` : ''}
                  </div>
                )}
                <div className="flex gap-2">
                  {onEdit && (
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => onEdit(p)}
                      aria-label={`Edit product ${p.name}`}
                    >
                      <Pencil className="size-4" />
                      Edit product
                    </Button>
                  )}
                  {onPrintLabel && (
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => onPrintLabel(p)}
                      aria-label={`Print label for ${p.name}`}
                    >
                      <Tags className="size-4" />
                      Print label
                    </Button>
                  )}
                </div>
              </div>
            )}
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
