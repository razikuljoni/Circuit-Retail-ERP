'use client'

// ── Cart panel — shared between the desktop sticky card and the mobile sheet ──
// Items list with qty steppers + line discounts, totals, order discount,
// customer, note, payment method tabs and the Charge / Hold actions.
import { useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  Banknote,
  CreditCard,
  Minus,
  Package,
  Plus,
  Smartphone,
  Tag,
  Trash2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { currencySymbol, fmtMoney, fmtQty } from '@/lib/format'
import type { Customer, PaymentMethod } from '@/lib/types'
import { cartTotals, MIN_QTY, usePosStore } from '@/store/pos'
import { hashColor } from '@/components/views/products/colors'

/** Mini gradient tile matching the POS grid thumbnails (keyed off SKU). */
function CartThumb({ sku, name }: { sku: string; name: string }) {
  const color = hashColor(sku)
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
  return (
    <span
      aria-hidden
      className="flex size-8 shrink-0 select-none items-center justify-center rounded-md text-[11px] font-bold text-white shadow-sm ring-1 ring-black/5"
      style={{ background: `linear-gradient(135deg, ${color} 0%, ${color}B3 100%)` }}
    >
      {initials || '?'}
    </span>
  )
}

/** Qty input that lets users type decimals freely, committing valid values. */
function QtyInput({ value, max, productId, label }: { value: number; max: number; productId: string; label: string }) {
  const setQty = usePosStore((s) => s.setQty)
  // null draft = not editing → always display the live store value (steppers stay in sync)
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? fmtQty(value)

  return (
    <Input
      type="number"
      inputMode="decimal"
      min={MIN_QTY}
      max={max}
      step={1}
      value={shown}
      aria-label={`Quantity for ${label}`}
      className="h-8 w-12 rounded-md px-1 text-center text-xs tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      onFocus={(e) => {
        setDraft(fmtQty(value))
        requestAnimationFrame(() => e.currentTarget.select())
      }}
      onBlur={() => setDraft(null)}
      onChange={(e) => {
        setDraft(e.target.value)
        const parsed = Number(e.target.value)
        if (e.target.value.trim() !== '' && Number.isFinite(parsed) && parsed > 0) {
          setQty(productId, parsed)
        }
      }}
    />
  )
}

export function CartPanel({
  customers,
  onCheckout,
}: {
  customers: Customer[]
  onCheckout: () => void
}) {
  const cart = usePosStore((s) => s.cart)
  const customerId = usePosStore((s) => s.customerId)
  const orderDiscount = usePosStore((s) => s.orderDiscount)
  const note = usePosStore((s) => s.note)
  const paymentMethod = usePosStore((s) => s.paymentMethod)
  const setQty = usePosStore((s) => s.setQty)
  const removeItem = usePosStore((s) => s.removeItem)
  const setLineDiscount = usePosStore((s) => s.setLineDiscount)
  const setCustomerId = usePosStore((s) => s.setCustomerId)
  const setOrderDiscount = usePosStore((s) => s.setOrderDiscount)
  const setNote = usePosStore((s) => s.setNote)
  const setPaymentMethod = usePosStore((s) => s.setPaymentMethod)
  const holdCart = usePosStore((s) => s.holdCart)

  const [discEditor, setDiscEditor] = useState<string | null>(null)

  const totals = cartTotals(cart, orderDiscount)
  const symbol = currencySymbol()

  const handleHold = () => {
    holdCart()
    toast.success('Cart held — start the next sale')
  }

  return (
    <div className="space-y-3">
      {/* Items */}
      {cart.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-8 text-center">
          <Package className="mb-2 size-7 text-muted-foreground/50" aria-hidden />
          <p className="text-sm font-medium">Cart is empty</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Search or tap products to start a sale
          </p>
        </div>
      ) : (
        <ul className="max-h-[38vh] space-y-2 overflow-y-auto pr-1 lg:max-h-[40vh]">
          {cart.map((item) => {
            const lineTotal = item.unitPrice * item.qty - item.discount
            return (
              <li key={item.key} className="rounded-lg border bg-card/60 p-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2">
                    <CartThumb sku={item.sku} name={item.name} />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium">{item.name}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">
                        {item.sku} · {fmtMoney(item.unitPrice)}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-bold tabular-nums">{fmtMoney(lineTotal)}</span>
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="outline"
                      className="size-8"
                      disabled={item.qty <= MIN_QTY}
                      onClick={() => setQty(item.productId, item.qty - 1)}
                      aria-label={`Decrease quantity of ${item.name}`}
                    >
                      <Minus className="size-3.5" />
                    </Button>
                    <QtyInput value={item.qty} max={item.stock} productId={item.productId} label={item.name} />
                    <Button
                      size="icon"
                      variant="outline"
                      className="size-8"
                      disabled={item.qty >= item.stock}
                      onClick={() => setQty(item.productId, item.qty + 1)}
                      aria-label={`Increase quantity of ${item.name}`}
                    >
                      <Plus className="size-3.5" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <Button
                      size="sm"
                      variant={discEditor === item.key || item.discount > 0 ? 'secondary' : 'ghost'}
                      className="h-8 gap-1 px-2 text-[11px]"
                      onClick={() => setDiscEditor(discEditor === item.key ? null : item.key)}
                      aria-label={`Line discount for ${item.name}`}
                    >
                      <Tag className="size-3" />
                      {item.discount > 0 ? `−${fmtMoney(item.discount)}` : 'Disc'}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8 text-muted-foreground hover:text-destructive"
                      onClick={() => removeItem(item.productId)}
                      aria-label={`Remove ${item.name} from cart`}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
                {discEditor === item.key && (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <div className="relative flex-1">
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step={1}
                        value={item.discount || ''}
                        placeholder="0"
                        aria-label={`Discount amount for ${item.name}`}
                        className="h-8 pr-6 text-right text-xs [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        autoFocus
                        onChange={(e) => setLineDiscount(item.productId, Number(e.target.value) || 0)}
                      />
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                        {symbol}
                      </span>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      onClick={() => {
                        setLineDiscount(item.productId, 0)
                        setDiscEditor(null)
                      }}
                      aria-label={`Clear discount for ${item.name}`}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {/* Totals + order discount */}
      <div className="space-y-1.5 rounded-lg bg-muted/50 p-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-semibold tabular-nums">{fmtMoney(totals.subtotal)}</span>
        </div>
        {totals.itemDiscounts + totals.orderDiscount > 0 && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Discounts</span>
            <span className="font-semibold tabular-nums text-red-600 dark:text-red-400">
              −{fmtMoney(totals.itemDiscounts + totals.orderDiscount)}
            </span>
          </div>
        )}
        {totals.tax > 0 && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Tax</span>
            <span className="font-semibold tabular-nums">{fmtMoney(totals.tax)}</span>
          </div>
        )}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <label htmlFor="order-discount" className="text-xs text-muted-foreground">
            Order discount
          </label>
          <div className="relative w-28">
            <Input
              id="order-discount"
              type="number"
              inputMode="decimal"
              min={0}
              step={1}
              value={orderDiscount || ''}
              placeholder="0"
              aria-label="Order discount amount"
              className="h-8 pr-6 text-right text-xs tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              onChange={(e) => setOrderDiscount(Number(e.target.value) || 0)}
            />
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
              {symbol}
            </span>
          </div>
        </div>
        <Separator className="my-1" />
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-bold">TOTAL</span>
          <span className="text-lg font-bold tabular-nums">{fmtMoney(totals.total)}</span>
        </div>
        <p className="text-right text-[10px] text-muted-foreground">
          {fmtQty(totals.count)} item{totals.count === 1 ? '' : 's'}
        </p>
      </div>

      {/* Customer */}
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="pos-customer">
          Customer
        </label>
        <select
          id="pos-customer"
          value={customerId ?? ''}
          onChange={(e) => setCustomerId(e.target.value || null)}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-xs shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <option value="">Walk-in Customer</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.phone ? ` — ${c.phone}` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Note */}
      <Input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (optional)"
        aria-label="Sale note"
        className="h-10 text-xs"
        maxLength={200}
      />

      {/* Payment method */}
      <Tabs value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
        <TabsList className="grid h-12 w-full grid-cols-3">
          <TabsTrigger value="CASH" className="gap-1.5 py-2">
            <Banknote className="size-4" aria-hidden /> Cash
          </TabsTrigger>
          <TabsTrigger value="CARD" className="gap-1.5 py-2">
            <CreditCard className="size-4" aria-hidden /> Card
          </TabsTrigger>
          <TabsTrigger value="MOBILE" className="gap-1.5 py-2">
            <Smartphone className="size-4" aria-hidden /> Mobile
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          className="h-12 flex-1"
          disabled={cart.length === 0}
          onClick={handleHold}
          aria-label="Hold current cart"
        >
          <Package className="size-4" /> Hold
        </Button>
        <motion.div whileTap={cart.length > 0 ? { scale: 0.98 } : undefined} className="flex-[2.2]">
          <Button
            size="lg"
            className="h-12 w-full text-base font-bold"
            disabled={cart.length === 0}
            onClick={onCheckout}
          >
            Charge {fmtMoney(totals.total)}
          </Button>
        </motion.div>
      </div>
    </div>
  )
}
