'use client'

// ── POS Terminal — catalog search + cart + checkout + receipts ────────────────
// Keyboard: F2 focuses search, F9 opens checkout. On mobile the cart collapses
// into a sticky bottom bar that opens the cart in a Sheet.
import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  Inbox,
  PackageOpen,
  ScanBarcode,
  Search,
  ShoppingBag,
  Trash2,
  X,
  Zap,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { EmptyState, ErrorState, PageHeader, Spinner } from '@/components/shared/page-bits'
import { cn } from '@/lib/utils'
import { fmtDate, fmtMoney, fmtQty, fmtTime } from '@/lib/format'
import type { Category, Customer, Product, Sale } from '@/lib/types'
import { useApi } from '@/hooks/use-api'
import { cartTotals, usePosStore } from '@/store/pos'
import { hashColor } from './products/colors'
import { CartPanel } from '@/components/views/sales/cart-panel'
import { CheckoutDialog } from '@/components/views/sales/checkout-dialog'
import { ReceiptDialog } from '@/components/views/sales/receipt'

const MAX_RENDER = 60

/** Deterministic gradient tile with product initials — visual anchor per card. */
function ProductThumb({ product }: { product: Product }) {
  const color = hashColor(product.categoryId ?? product.sku)
  const initials = product.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
  return (
    <span
      aria-hidden
      className="flex size-10 shrink-0 select-none items-center justify-center rounded-lg text-[13px] font-bold tracking-wide text-white shadow-sm ring-1 ring-black/5"
      style={{ background: `linear-gradient(135deg, ${color} 0%, ${color}B3 100%)` }}
    >
      {initials || '?'}
    </span>
  )
}

/** Stock-depth bar: full = ≥3× reorder level, amber = low, red = out. */
function StockBar({ product }: { product: Product }) {
  const out = product.stock <= 0
  const low = !out && product.stock <= product.reorderLevel
  const pct = Math.min(100, Math.round((product.stock / Math.max(1, product.reorderLevel * 3)) * 100))
  return (
    <span
      className="block h-1 w-full overflow-hidden rounded-full bg-muted"
      role="img"
      aria-label={out ? 'Out of stock' : low ? 'Low stock' : 'In stock'}
    >
      <span
        className={cn(
          'block h-full rounded-full transition-all',
          out ? 'bg-destructive' : low ? 'bg-amber-500' : 'bg-emerald-500/80'
        )}
        style={{ width: `${out ? 100 : Math.max(6, pct)}%` }}
      />
    </span>
  )
}

function StockBadge({ product }: { product: Product }) {
  if (product.stock <= 0) {
    return (
      <Badge className="border-transparent bg-destructive/10 text-destructive" variant="secondary">
        Out
      </Badge>
    )
  }
  if (product.stock <= product.reorderLevel) {
    return (
      <Badge className="border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400" variant="secondary">
        Low {fmtQty(product.stock)}
      </Badge>
    )
  }
  return <Badge variant="secondary">{fmtQty(product.stock)}</Badge>
}

export default function PosView() {
  const { data: products, loading: productsLoading, error: productsError, refetch: refetchProducts } =
    useApi<Product[]>('/api/products?limit=500')
  const { data: categories } = useApi<Category[]>('/api/categories')
  const { data: customers } = useApi<Customer[]>('/api/customers')

  const cart = usePosStore((s) => s.cart)
  const held = usePosStore((s) => s.held)
  const orderDiscount = usePosStore((s) => s.orderDiscount)
  const addItem = usePosStore((s) => s.addItem)
  const clearCart = usePosStore((s) => s.clearCart)
  const resumeCart = usePosStore((s) => s.resumeCart)
  const deleteHeld = usePosStore((s) => s.deleteHeld)

  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [cartSheetOpen, setCartSheetOpen] = useState(false)
  const [heldOpen, setHeldOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [clearOpen, setClearOpen] = useState(false)
  const [receiptSale, setReceiptSale] = useState<Sale | null>(null)

  const searchRef = useRef<HTMLInputElement>(null)

  const totals = cartTotals(cart, orderDiscount)

  // ── Catalog filtering ──────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const list = products ?? []
    const q = query.trim().toLowerCase()
    return list.filter((p) => {
      if (activeCategory && p.categoryId !== activeCategory) return false
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode ? p.barcode.toLowerCase().includes(q) : false)
      )
    })
  }, [products, query, activeCategory])

  /**
   * Scanner-wedge aware Enter handler:
   *  - "3*SKU" / "3xBARCODE" prefix adds that quantity in one scan
   *  - exact barcode / SKU match always wins over substring matches
   *  - no match → clear feedback instead of silently doing nothing
   */
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    const raw = query.trim()
    if (!raw) return

    // Quantity prefix: "3*STA-001", "2x6901234567890"
    let qty: number | undefined
    let code = raw
    const prefixMatch = /^([1-9]\d*(?:\.5)?)\s*[*xX×]\s*(.+)$/.exec(raw)
    if (prefixMatch) {
      qty = Number(prefixMatch[1])
      code = prefixMatch[2].trim()
    }

    const q = code.toLowerCase()
    const exact =
      (products ?? []).find((p) => p.barcode && p.barcode.toLowerCase() === q) ??
      (products ?? []).find((p) => p.sku.toLowerCase() === q)
    const target = exact ?? filtered[0]

    if (!target) {
      toast.error(`No product matches "${code}"`, { description: 'Check the code or add the product first.' })
      return
    }
    addItem(target, qty)
    setQuery('')
    // Keep focus in the search box for rapid barcode-style entry.
    requestAnimationFrame(() => searchRef.current?.focus())
  }

  // Autofocus search on mount — POS-first workflow.
  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  // ── Global keyboard shortcuts ──────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault()
        searchRef.current?.focus()
      } else if (e.key === 'F9') {
        e.preventDefault()
        if (usePosStore.getState().cart.length > 0) setCheckoutOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const handleClearCart = () => {
    clearCart()
    setClearOpen(false)
    toast.success('Cart cleared')
  }

  const handleResume = (id: string) => {
    resumeCart(id)
    setHeldOpen(false)
    toast.success('Held cart resumed')
  }

  const handleDeleteHeld = (id: string) => {
    deleteHeld(id)
    toast.success('Held cart deleted')
  }

  const handleCheckoutComplete = (sale: Sale) => {
    // Stock changed server-side — refresh the catalog quietly.
    void refetchProducts()
    setReceiptSale(sale)
  }

  return (
    <div className="pb-24 lg:pb-0">
      <PageHeader
        icon={Zap}
        title="POS Terminal"
        subtitle="Scan or search products to build a sale"
        actions={
          <>
            <Button variant="outline" className="h-10" onClick={() => setHeldOpen(true)}>
              <Inbox className="size-4" aria-hidden />
              Held
              <Badge variant="secondary" aria-label={`${held.length} held carts`}>
                {held.length}
              </Badge>
            </Button>
            <Button
              variant="ghost"
              className="h-10 text-muted-foreground hover:text-destructive"
              disabled={cart.length === 0}
              onClick={() => setClearOpen(true)}
            >
              <Trash2 className="size-4" aria-hidden /> Clear
            </Button>
          </>
        }
      />

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_400px] lg:gap-6">
        {/* ── LEFT: catalog ─────────────────────────────────────────────────── */}
        <section aria-label="Product catalog" className="min-w-0">
          {/* Search row */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <ScanBarcode
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search name / SKU / barcode — Enter adds first match"
                aria-label="Search products"
                title="Tip: 3*SKU or 3xBARCODE adds 3 units in one scan"
                className="h-11 pl-9 pr-9"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('')
                    searchRef.current?.focus()
                  }}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
            <div className="flex h-11 items-center gap-2 rounded-md border bg-muted/40 px-3 text-xs text-muted-foreground sm:w-auto sm:border-0 sm:bg-transparent sm:px-0">
              <Search className="size-3.5 shrink-0" aria-hidden />
              <span className="tabular-nums">
                {filtered.length} product{filtered.length === 1 ? '' : 's'}
              </span>
            </div>
          </div>

          {/* Category chips */}
          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              onClick={() => setActiveCategory(null)}
              aria-pressed={activeCategory === null}
              className={cn(
                'h-9 shrink-0 rounded-full border px-3.5 text-xs font-semibold transition-colors sm:h-8',
                activeCategory === null
                  ? 'border-transparent bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              All
            </button>
            {(categories ?? []).map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
                aria-pressed={activeCategory === cat.id}
                className={cn(
                  'h-9 shrink-0 rounded-full border px-3.5 text-xs font-semibold transition-colors sm:h-8',
                  activeCategory === cat.id
                    ? 'border-transparent bg-primary text-primary-foreground'
                    : 'bg-background text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Product grid */}
          <div className="mt-3">
            {productsError ? (
              <ErrorState message={productsError} onRetry={() => void refetchProducts()} />
            ) : productsLoading && !products ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-24 animate-pulse rounded-xl border bg-muted/40" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={PackageOpen}
                title="No products found"
                message={
                  query
                    ? `Nothing matches “${query}”. Try a different name, SKU or barcode.`
                    : 'No active products in this category yet.'
                }
                action={
                  (query || activeCategory) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setQuery('')
                        setActiveCategory(null)
                      }}
                    >
                      Clear filters
                    </Button>
                  )
                }
              />
            ) : (
              <>
                <div className="grid max-h-none grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3 lg:max-h-[calc(100vh-19rem)] xl:grid-cols-4 lg:pr-1">
                  {filtered.slice(0, MAX_RENDER).map((p) => {
                    const out = p.stock <= 0
                    return (
                      <motion.button
                        key={p.id}
                        type="button"
                        disabled={out}
                        whileTap={out ? undefined : { scale: 0.97 }}
                        onClick={() => addItem(p)}
                        aria-label={`Add ${p.name} to sale`}
                        className={cn(
                          'group flex min-h-[5.75rem] flex-col gap-1.5 rounded-xl border bg-card p-2.5 text-left shadow-xs',
                          'transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                          out
                            ? 'cursor-not-allowed opacity-50'
                            : 'hover:-translate-y-0.5 hover:border-primary/40 hover:bg-accent/40 hover:shadow-md active:translate-y-0 active:shadow-xs'
                        )}
                      >
                        <span className="flex items-start gap-2">
                          <ProductThumb product={p} />
                          <span className="min-w-0 flex-1">
                            <span className="line-clamp-2 text-xs font-medium leading-4">{p.name}</span>
                            <span className="mt-0.5 block truncate font-mono text-[10px] text-muted-foreground">
                              {p.sku}
                            </span>
                          </span>
                        </span>
                        <span className="mt-auto flex items-center justify-between gap-1">
                          <span className="text-sm font-bold tracking-tight">{fmtMoney(p.price)}</span>
                          <StockBadge product={p} />
                        </span>
                        <StockBar product={p} />
                      </motion.button>
                    )
                  })}
                </div>
                {filtered.length > MAX_RENDER && (
                  <p className="mt-2 text-center text-[11px] text-muted-foreground">
                    Showing {MAX_RENDER} of {filtered.length} — refine search to see more
                  </p>
                )}
              </>
            )}
          </div>
        </section>

        {/* ── RIGHT: cart (desktop) ─────────────────────────────────────────── */}
        <aside className="hidden lg:sticky lg:top-20 lg:block" aria-label="Current sale">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                Current sale
                <Badge variant="secondary" aria-label={`${totals.count} items in cart`}>
                  {fmtQty(totals.count)}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <CartPanel customers={customers ?? []} onCheckout={() => setCheckoutOpen(true)} />
            </CardContent>
          </Card>
        </aside>
      </div>

      {/* ── Mobile sticky bottom bar ────────────────────────────────────────── */}
      <div
        className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between border-t bg-background/95 p-3 backdrop-blur lg:hidden"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        <div className="min-w-0 pl-1">
          <p className="truncate text-sm font-bold tabular-nums">{fmtMoney(totals.total)}</p>
          <p className="text-[11px] text-muted-foreground">
            {fmtQty(totals.count)} item{totals.count === 1 ? '' : 's'} · {held.length} held
          </p>
        </div>
        <Button className="h-11 px-5 font-bold" onClick={() => setCartSheetOpen(true)}>
          <ShoppingBag className="size-4" aria-hidden /> Cart
          {cart.length > 0 && (
            <Badge className="ml-1 border-transparent bg-primary-foreground/20 text-primary-foreground" variant="secondary">
              {cart.length}
            </Badge>
          )}
        </Button>
      </div>

      {/* ── Cart sheet (mobile) ─────────────────────────────────────────────── */}
      <Sheet open={cartSheetOpen} onOpenChange={setCartSheetOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b px-4 py-3.5">
            <SheetTitle className="flex items-center gap-2 text-sm">
              Current sale
              <Badge variant="secondary">{fmtQty(totals.count)}</Badge>
            </SheetTitle>
            <SheetDescription className="sr-only">Review and charge the current cart</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <CartPanel
              customers={customers ?? []}
              onCheckout={() => {
                setCartSheetOpen(false)
                setCheckoutOpen(true)
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Held carts sheet ────────────────────────────────────────────────── */}
      <Sheet open={heldOpen} onOpenChange={setHeldOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-sm">
          <SheetHeader className="border-b px-4 py-3.5">
            <SheetTitle className="flex items-center gap-2 text-sm">
              <Inbox className="size-4" aria-hidden /> Held carts
              {held.length > 0 && <Badge variant="secondary">{held.length}</Badge>}
            </SheetTitle>
            <SheetDescription className="sr-only">Resume or delete parked carts</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {held.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="No held sales"
                message="Hold a cart to park it while you serve the next customer."
              />
            ) : (
              <ul className="space-y-2">
                {held.map((h) => {
                  const t = cartTotals(h.cart, h.orderDiscount)
                  return (
                    <li key={h.id} className="flex items-center justify-between gap-2 rounded-lg border p-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold">
                          {h.cart.length} line item{h.cart.length === 1 ? '' : 's'} · {fmtMoney(t.total)}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {fmtDate(h.savedAt)} · {fmtTime(h.savedAt)}
                          {h.note ? ` · ${h.note}` : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button size="sm" variant="outline" className="h-9" onClick={() => handleResume(h.id)}>
                          Resume
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-9 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteHeld(h.id)}
                          aria-label="Delete held cart"
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Dialogs ─────────────────────────────────────────────────────────── */}
      <CheckoutDialog open={checkoutOpen} onOpenChange={setCheckoutOpen} onCompleted={handleCheckoutComplete} customers={customers ?? []} />
      <ReceiptDialog sale={receiptSale} onDone={() => setReceiptSale(null)} />
      <ConfirmDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        title="Clear current sale?"
        message={
          cart.length > 0
            ? `Remove all ${cart.length} line item${cart.length === 1 ? '' : 's'} from the cart? Held carts are not affected.`
            : 'Remove all items from the cart?'
        }
        confirmLabel="Clear cart"
        onConfirm={handleClearCart}
      />

      {/* First-load hint while products stream in on desktop only — mobile bar sits above */}
      {productsLoading && !products && (
        <div className="pointer-events-none fixed bottom-24 left-1/2 z-20 hidden -translate-x-1/2 lg:flex">
          <span className="flex items-center gap-2 rounded-full border bg-background/90 px-3 py-1.5 text-xs text-muted-foreground shadow-sm">
            <Spinner className="size-3" /> Loading catalog…
          </span>
        </div>
      )}
    </div>
  )
}

