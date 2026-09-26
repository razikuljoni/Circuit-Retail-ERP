'use client'

// ── Sale detail (full invoice) — reprint receipt, settle due, refund ──────
import { useState } from 'react'
import { toast } from 'sonner'
import { HandCoins, Printer, Undo2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { Spinner } from '@/components/shared/page-bits'
import { api } from '@/lib/api'
import { fmtDateTime, fmtMoney, fmtQty } from '@/lib/format'
import type { Sale } from '@/lib/types'
import { useMutation } from '@/hooks/use-api'

interface SettledSale extends Sale {
  settledNow?: number
}

export function SaleDetailDialog({
  sale,
  open,
  onOpenChange,
  onPrint,
  onRefunded,
}: {
  sale: Sale | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onPrint: (sale: Sale) => void
  onRefunded: (sale: Sale) => void
}) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [settling, setSettling] = useState(false)

  const refund = useMutation(async () => {
    if (!sale) throw new Error('No sale selected')
    return api.post<Sale>(`/api/sales/${sale.id}/refund`)
  })

  const settleDue = async () => {
    if (!sale) return
    setSettling(true)
    try {
      const updated = await api.post<SettledSale>(`/api/sales/${sale.id}/settle`, {
        amount: Number.MAX_SAFE_INTEGER, // server caps at the outstanding balance
      })
      toast.success(`Payment recorded for ${updated.invoiceNo}`, {
        description: `${fmtMoney(updated.settledNow ?? 0)} collected`,
      })
      onRefunded(updated) // reuse the live-update path (sale replaced)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to settle invoice')
    } finally {
      setSettling(false)
    }
  }

  const handleRefund = async () => {
    try {
      const updated = await refund.run()
      if (!updated) return
      toast.success(`Sale ${updated.invoiceNo} refunded`, {
        description: 'Stock has been restored.',
      })
      setConfirmOpen(false)
      onRefunded(updated)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Refund failed')
    }
  }

  const refunded = sale?.status === 'REFUNDED'

  return (
    <>
      <Dialog open={open && !!sale} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg gap-3">
          {sale && (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2 font-mono text-sm sm:text-base">
                  {sale.invoiceNo}
                  {refunded ? (
                    <Badge variant="destructive">REFUNDED</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-emerald-600 dark:text-emerald-400">
                      COMPLETED
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {fmtDateTime(sale.createdAt)} · Paid via {sale.paymentMethod.toLowerCase()}
                </DialogDescription>
              </DialogHeader>

              <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
                {/* Customer + note */}
                <div className="rounded-lg border p-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Customer</span>
                    <span className="font-semibold">
                      {sale.customer ? sale.customer.name : 'Walk-in Customer'}
                      {sale.customer?.phone ? (
                        <span className="ml-1 font-normal text-muted-foreground">{sale.customer.phone}</span>
                      ) : null}
                    </span>
                  </div>
                  {sale.note && (
                    <p className="mt-1.5 border-t pt-1.5 text-muted-foreground italic">“{sale.note}”</p>
                  )}
                </div>

                {/* Items */}
                <div className="overflow-hidden rounded-lg border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/60 text-left text-[11px] text-muted-foreground">
                        <th className="px-3 py-2 font-medium">Item</th>
                        <th className="px-2 py-2 text-right font-medium">Qty</th>
                        <th className="px-2 py-2 text-right font-medium">Unit</th>
                        <th className="px-2 py-2 text-right font-medium">Disc</th>
                        <th className="px-3 py-2 text-right font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sale.items.map((item) => (
                        <tr key={item.id} className="border-b last:border-0">
                          <td className="px-3 py-2">
                            <p className="font-medium">{item.name}</p>
                            <p className="font-mono text-[10px] text-muted-foreground">{item.sku}</p>
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums">{fmtQty(item.qty)}</td>
                          <td className="px-2 py-2 text-right tabular-nums">{fmtMoney(item.unitPrice)}</td>
                          <td className="px-2 py-2 text-right tabular-nums">
                            {item.discount > 0 ? (
                              <span className="text-red-600 dark:text-red-400">−{fmtMoney(item.discount)}</span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold tabular-nums">
                            {fmtMoney(item.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div className="ml-auto w-full max-w-56 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="tabular-nums">{fmtMoney(sale.subtotal)}</span>
                  </div>
                  {sale.discount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Discount</span>
                      <span className="tabular-nums text-red-600 dark:text-red-400">−{fmtMoney(sale.discount)}</span>
                    </div>
                  )}
                  {sale.tax > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tax</span>
                      <span className="tabular-nums">{fmtMoney(sale.tax)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between text-sm font-bold">
                    <span>Total</span>
                    <span className={refunded ? 'tabular-nums text-red-600 line-through dark:text-red-400' : 'tabular-nums'}>
                      {fmtMoney(sale.total)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Paid</span>
                    <span className="tabular-nums">{fmtMoney(sale.paid)}</span>
                  </div>
                  {(sale.due ?? 0) > 0 ? (
                    <div className="flex justify-between">
                      <span className="font-medium text-amber-700 dark:text-amber-400">Due (credit)</span>
                      <span className="font-bold tabular-nums text-amber-700 dark:text-amber-400">
                        {fmtMoney(sale.due ?? 0)}
                      </span>
                    </div>
                  ) : (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Change</span>
                      <span className="tabular-nums">{fmtMoney(sale.change)}</span>
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="flex-col gap-2 sm:flex-row sm:gap-2">
                <Button variant="outline" className="h-11 sm:flex-1" onClick={() => onPrint(sale)}>
                  <Printer className="size-4" /> Print receipt
                </Button>
                {!refunded && (sale.due ?? 0) > 0 && (
                  <Button
                    variant="outline"
                    className="h-11 border-emerald-500/50 sm:flex-1 hover:bg-emerald-500/10"
                    disabled={settling}
                    onClick={() => void settleDue()}
                  >
                    {settling ? <Spinner className="size-4" /> : <HandCoins className="size-4" />}
                    Settle {fmtMoney(sale.due ?? 0)}
                  </Button>
                )}
                {!refunded ? (
                  <Button
                    variant="destructive"
                    className="h-11 sm:flex-1"
                    disabled={refund.pending}
                    onClick={() => setConfirmOpen(true)}
                  >
                    {refund.pending ? <Spinner className="mr-1.5" /> : <Undo2 className="size-4" />} Refund sale
                  </Button>
                ) : (
                  <Button variant="outline" className="h-11 sm:flex-1" disabled>
                    <Undo2 className="size-4" /> Already refunded
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Refund this sale?"
        message={
          sale
            ? `Refund invoice ${sale.invoiceNo} for ${fmtMoney(sale.total)}? All items will be returned to stock and the sale marked as REFUNDED. This cannot be undone.`
            : ''
        }
        confirmLabel="Refund sale"
        pending={refund.pending}
        onConfirm={handleRefund}
      />
    </>
  )
}
