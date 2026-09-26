'use client'

// ── Checkout dialog — cash quick-chips, paid/change calc, sale submission ─────
// The interactive form lives inside DialogContent, so Radix unmounts it on
// close and every open starts from a fresh "paid" state (no reset effects).
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { BadgeCheck, HandCoins, UserRound } from 'lucide-react'
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
import { cn } from '@/lib/utils'
import { fmtMoney } from '@/lib/format'
import type { Customer, Sale } from '@/lib/types'
import { useMutation } from '@/hooks/use-api'
import { cartTotals, usePosStore } from '@/store/pos'

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function CheckoutDialog({
  open,
  onOpenChange,
  onCompleted,
  customers,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCompleted: (sale: Sale) => void
  customers: Customer[]
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-4" aria-describedby={undefined}>
        {open && <CheckoutForm onOpenChange={onOpenChange} onCompleted={onCompleted} customers={customers} />}
      </DialogContent>
    </Dialog>
  )
}

function CheckoutForm({
  onOpenChange,
  onCompleted,
  customers,
}: {
  onOpenChange: (open: boolean) => void
  onCompleted: (sale: Sale) => void
  customers: Customer[]
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
  // Credit sales: partial payment is allowed when the sale is attached to a customer
  const creditAllowed = customerId !== null && customerId !== undefined && customerId !== ''
  const creditBlocked = due > 0 && !creditAllowed

  // Credit-limit awareness: show remaining head-room, block when the due exceeds it
  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === customerId) ?? null,
    [customers, customerId]
  )
  const hasLimit = selectedCustomer?.creditLimit != null
  const limitRemaining = hasLimit
    ? round2((selectedCustomer!.creditLimit as number) - (selectedCustomer!.totalDue ?? 0))
    : null
  const overLimit = hasLimit && due > 0 && limitRemaining !== null && due > limitRemaining + 0.001

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
    if (due > 0 && !creditAllowed) return
    try {
      const sale = await createSale.run()
      if (!sale) return
      toast.success(`Sale ${sale.invoiceNo} completed`, {
        description:
          due > 0
            ? `${fmtMoney(sale.total)} · ${(sale.due ?? due) > 0 ? `${fmtMoney(sale.due ?? due)} due on account` : ''}`
            : `${fmtMoney(sale.total)} · ${sale.items.length} line item${sale.items.length === 1 ? '' : 's'}`,
      })
      clearCart()
      onOpenChange(false)
      onCompleted(sale)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to complete sale')
    }
  }

  const canConfirm =
    cart.length > 0 && !createSale.pending && (due <= 0 || (creditAllowed && !overLimit))

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
      <div
        className={cn(
          'flex items-center justify-between rounded-lg px-4 py-3',
          creditBlocked
            ? 'bg-destructive/10'
            : due > 0
              ? 'bg-amber-500/10'
              : 'bg-muted/60'
        )}
      >
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {due > 0 ? (creditAllowed ? 'Due on account' : 'Unpaid — needs full payment') : 'Change'}
          </p>
          <p
            className={`text-2xl font-bold tabular-nums ${
              due > 0
                ? creditAllowed
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-red-600 dark:text-red-400'
                : 'text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {due > 0 ? fmtMoney(due) : fmtMoney(Math.max(0, diff))}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Paid</p>
          <p className="text-sm font-semibold tabular-nums">{fmtMoney(paidNum)}</p>
        </div>
      </div>

      {/* Credit hint when a partial payment is blocked */}
      {creditBlocked && (
        <p className="flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          <UserRound className="size-3.5 shrink-0" aria-hidden />
          Select a customer in the cart panel to record the {fmtMoney(due)} balance as credit (due).
        </p>
      )}

      {/* Credit-limit panel for the selected customer */}
      {creditAllowed && hasLimit && (
        <p
          className={cn(
            'flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs',
            overLimit
              ? 'border-red-500/50 bg-red-500/5 text-red-700 dark:text-red-400'
              : limitRemaining !== null && limitRemaining < due
                ? 'border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-400'
                : 'border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400'
          )}
          aria-live="polite"
        >
          <UserRound className="size-3.5 shrink-0" aria-hidden />
          {overLimit ? (
            <span>
              <strong>{selectedCustomer?.name}</strong> has only <strong>{fmtMoney(limitRemaining ?? 0)}</strong> of
              credit left — this sale leaves {fmtMoney(due)} due. Collect the balance or raise the limit.
            </span>
          ) : (
            <span>
              Credit remaining for <strong>{selectedCustomer?.name}</strong>:{' '}
              <strong>{fmtMoney(limitRemaining ?? 0)}</strong>
              {limitRemaining !== null && limitRemaining - due < 0 && ' — this sale exceeds it'}
            </span>
          )}
        </p>
      )}

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
        {creditAllowed && (
          <p className="text-[11px] text-muted-foreground">
            Tip: enter less than the total to leave the rest as credit due on the customer's account.
          </p>
        )}
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
              {due > 0 && creditAllowed && (
                <span className="ml-1 font-semibold text-amber-300">· {fmtMoney(due)} due</span>
              )}
            </>
          )}
        </Button>
      </DialogFooter>
    </div>
  )
}
