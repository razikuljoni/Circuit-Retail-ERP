'use client'

// ── Checkout dialog — cash quick-chips, paid/change calc, sale submission ─────
// The interactive form lives inside DialogContent, so Radix unmounts it on
// close and every open starts from a fresh "paid" state (no reset effects).
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { BadgeCheck, HandCoins } from 'lucide-react'
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
import { api } from '@/lib/api'
import { fmtMoney } from '@/lib/format'
import type { Sale } from '@/lib/types'
import { useMutation } from '@/hooks/use-api'
import { cartTotals, usePosStore } from '@/store/pos'

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function CheckoutDialog({
  open,
  onOpenChange,
  onCompleted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCompleted: (sale: Sale) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-4" aria-describedby={undefined}>
        {open && <CheckoutForm onOpenChange={onOpenChange} onCompleted={onCompleted} />}
      </DialogContent>
    </Dialog>
  )
}

function CheckoutForm({
  onOpenChange,
  onCompleted,
}: {
  onOpenChange: (open: boolean) => void
  onCompleted: (sale: Sale) => void
}) {
  const cart = usePosStore((s) => s.cart)
  const customerId = usePosStore((s) => s.customerId)
  const orderDiscount = usePosStore((s) => s.orderDiscount)
  const note = usePosStore((s) => s.note)
  const paymentMethod = usePosStore((s) => s.paymentMethod)
  const clearCart = usePosStore((s) => s.clearCart)

  // Fresh per open: CASH starts empty (cashier types/taps), card/mobile = exact.
  const [paidText, setPaidText] = useState(() =>
    paymentMethod === 'CASH' ? '' : cartTotals(cart, orderDiscount).total.toFixed(2)
  )

  const totals = cartTotals(cart, orderDiscount)
  const paidNum = round2(Number(paidText) || 0)
  const diff = round2(paidNum - totals.total)
  const due = Math.max(0, round2(totals.total - paidNum))

  /** Exact + next round numbers (100/200/500/1000/2000 ceilings). */
  const quickCash = useMemo(() => {
    const set = new Set<number>([totals.total])
    for (const step of [100, 200, 500, 1000, 2000]) {
      const v = Math.ceil(totals.total / step) * step
      if (v > totals.total) set.add(v)
    }
    return [...set].sort((a, b) => a - b).slice(0, 5)
  }, [totals.total])

  const createSale = useMutation(async () => {
    return api.post<Sale>('/api/sales', {
      items: cart.map((i) => ({
        productId: i.productId,
        qty: i.qty,
        unitPrice: i.unitPrice,
        discount: i.discount,
      })),
      customerId: customerId ?? undefined,
      paymentMethod,
      orderDiscount,
      paid: paidNum,
      note: note.trim() ? note.trim() : undefined,
    })
  })

  const handleConfirm = async () => {
    if (cart.length === 0) return
    if (paymentMethod === 'CASH' && due > 0) return
    try {
      const sale = await createSale.run()
      if (!sale) return
      toast.success(`Sale ${sale.invoiceNo} completed`, {
        description: `${fmtMoney(sale.total)} · ${sale.items.length} line item${sale.items.length === 1 ? '' : 's'}`,
      })
      clearCart()
      onOpenChange(false)
      onCompleted(sale)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to complete sale')
    }
  }

  const canConfirm = cart.length > 0 && !createSale.pending && (paymentMethod !== 'CASH' || due <= 0)

  return (
    <div className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-base">
          <HandCoins className="size-4 text-primary" aria-hidden /> Take payment
        </DialogTitle>
        <DialogDescription className="text-xs">
          {cart.length} line item{cart.length === 1 ? '' : 's'} · Total due{' '}
          <span className="font-bold text-foreground">{fmtMoney(totals.total)}</span>
        </DialogDescription>
      </DialogHeader>

      {/* Due / change */}
      <div className="flex items-center justify-between rounded-lg bg-muted/60 px-4 py-3">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {due > 0 && paymentMethod === 'CASH' ? 'Due' : 'Change'}
          </p>
          <p
            className={`text-2xl font-bold tabular-nums ${
              due > 0 && paymentMethod === 'CASH'
                ? 'text-red-600 dark:text-red-400'
                : 'text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {due > 0 && paymentMethod === 'CASH' ? fmtMoney(due) : fmtMoney(Math.max(0, diff))}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Paid</p>
          <p className="text-sm font-semibold tabular-nums">{fmtMoney(paidNum)}</p>
        </div>
      </div>

      {/* Quick cash chips (CASH only) */}
      {paymentMethod === 'CASH' && (
        <div className="flex flex-wrap gap-2">
          {quickCash.map((target) => (
            <button
              key={target}
              type="button"
              onClick={() => setPaidText(target.toFixed(2))}
              className="h-10 min-w-16 rounded-full border bg-background px-3.5 text-xs font-semibold tabular-nums shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {target === totals.total ? 'Exact' : fmtMoney(target)}
            </button>
          ))}
        </div>
      )}

      {/* Paid input */}
      <div className="space-y-1.5">
        <label htmlFor="checkout-paid" className="text-xs font-medium text-muted-foreground">
          Amount paid{' '}
          {paymentMethod !== 'CASH' && <span className="normal-case">(defaults to total — editable)</span>}
        </label>
        <Input
          id="checkout-paid"
          type="number"
          inputMode="decimal"
          min={0}
          step={1}
          value={paidText}
          placeholder="0.00"
          autoFocus
          className="h-12 text-right text-lg font-bold tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          onChange={(e) => setPaidText(e.target.value)}
        />
      </div>

      <DialogFooter className="gap-2 sm:gap-2">
        <Button
          variant="outline"
          className="h-11 sm:flex-1"
          disabled={createSale.pending}
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
        <Button className="h-11 font-bold sm:flex-[2]" disabled={!canConfirm} onClick={handleConfirm}>
          {createSale.pending ? (
            <>
              <Spinner className="mr-1.5" /> Completing…
            </>
          ) : (
            <>
              <BadgeCheck className="size-4" /> Confirm {fmtMoney(totals.total)}
            </>
          )}
        </Button>
      </DialogFooter>
    </div>
  )
}
