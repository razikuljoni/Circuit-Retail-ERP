'use client'

// ── Receive purchase order dialog — per-line partial quantities ──────────────
// POST /api/purchase-orders/[id]/receive { lines: [{ productId, qty, unitCost? }] }
// qty = THIS delivery's quantity; remaining = ordered − already received.
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { PackageCheck, PackageOpen, Undo2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Spinner } from '@/components/shared/page-bits'
import { api } from '@/lib/api'
import { fmtMoney, fmtQty } from '@/lib/format'
import type { PurchaseOrder } from '@/lib/types'

export function ReceiveDialog({
  po,
  open,
  onOpenChange,
  onReceived,
}: {
  po: PurchaseOrder | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onReceived: (updated: PurchaseOrder) => void
}) {
  // "Receiving now" per productId; defaults to remaining on open.
  const [qtyNow, setQtyNow] = useState<Record<string, number>>({})
  const [costNow, setCostNow] = useState<Record<string, number>>({})
  const [pending, setPending] = useState(false)

  // Re-seed defaults every time the dialog opens (prop-driven open doesn't
  // fire Dialog's onOpenChange, so an effect is the reliable hook).
  useEffect(() => {
    if (!open || !po) return
    const q: Record<string, number> = {}
    for (const it of po.items) q[it.productId] = Math.max(0, it.qty - (it.receivedQty ?? 0))
    setQtyNow(q)
    setCostNow({})
  }, [open, po])

  const lines = useMemo(
    () =>
      (po?.items ?? []).map((it) => {
        const received = it.receivedQty ?? 0
        const remaining = Math.max(0, it.qty - received)
        return { it, received, remaining, now: qtyNow[it.productId] ?? remaining }
      }),
    [po, qtyNow]
  )

  const totalNow = lines.reduce((s, l) => s + l.now * (costNow[l.it.productId] ?? l.it.unitCost), 0)
  const anyFilled = lines.some((l) => l.now > 0)
  const allFilled = lines.length > 0 && lines.every((l) => l.now >= l.remaining)

  function fillAll(v: number) {
    const q: Record<string, number> = {}
    for (const l of lines) q[l.it.productId] = v
    setQtyNow(q)
  }

  async function submit() {
    if (!po || !anyFilled) return
    setPending(true)
    try {
      const updated = await api.post<PurchaseOrder>(`/api/purchase-orders/${po.id}/receive`, {
        lines: lines
          .filter((l) => l.now > 0)
          .map((l) => ({
            productId: l.it.productId,
            qty: l.now,
            ...(costNow[l.it.productId] !== undefined && costNow[l.it.productId] !== l.it.unitCost
              ? { unitCost: costNow[l.it.productId] }
              : {}),
          })),
      })
      const units = updated.receivedNow ?? 0
      if (updated.status === 'RECEIVED') {
        toast.success(`Purchase order ${po.poNo} fully received`, {
          description: `${units} unit${units === 1 ? '' : 's'} added to inventory`,
        })
      } else {
        toast.info(`Partial receipt saved for ${po.poNo}`, {
          description: `${units} unit${units === 1 ? '' : 's'} received — remaining lines stay open`,
        })
      }
      onOpenChange(false)
      onReceived(updated)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to receive purchase order')
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-4" aria-describedby={undefined}>
        {open && po && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <span className="inline-flex size-6 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <PackageOpen className="size-3.5" aria-hidden />
                </span>
                Receive stock — {po.poNo}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Enter the quantity arriving in this delivery — partial receipts are fine and the order stays open until
                every line is complete.
              </DialogDescription>
            </DialogHeader>

            <div className="max-h-[46vh] overflow-y-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                  <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2 font-semibold">Product</th>
                    <th className="px-2 py-2 text-center font-semibold">Ordered</th>
                    <th className="px-2 py-2 text-center font-semibold">Received</th>
                    <th className="px-2 py-2 text-right font-semibold">Now</th>
                    <th className="px-3 py-2 text-right font-semibold">Unit cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {lines.map(({ it, received, remaining, now }) => {
                    const pct = Math.min(100, Math.round(((received + now) / Math.max(1, it.qty)) * 100))
                    const done = received >= it.qty
                    return (
                      <tr key={it.productId} className={done ? 'opacity-60' : undefined}>
                        <td className="max-w-[220px] px-3 py-2">
                          <div className="truncate font-medium leading-tight" title={it.name}>
                            {it.name}
                          </div>
                          <div className="font-mono text-[11px] text-muted-foreground">
                            {it.sku} · stock {fmtQty(it.product?.stock ?? 0)}
                          </div>
                          {/* delivery progress */}
                          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className={cnProgressBar(pct, done)}
                              style={{ width: `${pct}%` }}
                              role="progressbar"
                              aria-label={`${it.name} receive progress`}
                              aria-valuenow={pct}
                              aria-valuemin={0}
                              aria-valuemax={100}
                            />
                          </div>
                        </td>
                        <td className="px-2 py-2 text-center tabular-nums">{fmtQty(it.qty)}</td>
                        <td className="px-2 py-2 text-center">
                          {done ? (
                            <Badge
                              variant="outline"
                              className="border-emerald-500/30 bg-emerald-500/10 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400"
                            >
                              done
                            </Badge>
                          ) : (
                            <span className="text-xs tabular-nums text-muted-foreground">{fmtQty(received)}</span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-right">
                          <Input
                            type="number"
                            min={0}
                            max={remaining}
                            value={now}
                            disabled={done || pending}
                            aria-label={`Receiving now for ${it.name} (up to ${remaining})`}
                            className="h-8 w-20 text-right text-xs tabular-nums"
                            onChange={(e) => {
                              const raw = Math.max(0, Math.floor(Number(e.target.value) || 0))
                              setQtyNow((prev) => ({ ...prev, [it.productId]: Math.min(raw, remaining) }))
                            }}
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Input
                            type="number"
                            min={0}
                            step={0.5}
                            value={costNow[it.productId] ?? it.unitCost}
                            disabled={done || pending}
                            aria-label={`Unit cost for ${it.name}`}
                            className="h-8 w-24 text-right text-xs tabular-nums"
                            onChange={(e) =>
                              setCostNow((prev) => ({
                                ...prev,
                                [it.productId]: Math.max(0, Number(e.target.value) || 0),
                              }))
                            }
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/60 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-8" onClick={() => fillAll(9999)} disabled={pending}>
                  <PackageCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" /> Fill remaining
                </Button>
                <Button variant="ghost" size="sm" className="h-8" onClick={() => fillAll(0)} disabled={pending}>
                  <Undo2 className="size-3.5" /> Clear
                </Button>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">This delivery (at cost)</p>
                <p className="text-lg font-bold tabular-nums">{fmtMoney(totalNow)}</p>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" className="h-10" onClick={() => onOpenChange(false)} disabled={pending}>
                Cancel
              </Button>
              <Button className="h-10" disabled={!anyFilled || pending} onClick={() => void submit()}>
                {pending ? (
                  <Spinner className="mr-1.5" />
                ) : (
                  <PackageCheck className="size-4" />
                )}
                {allFilled ? 'Receive all' : 'Receive delivery'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function cnProgressBar(pct: number, done: boolean): string {
  if (done) return 'h-full rounded-full bg-emerald-500 transition-all'
  if (pct >= 100) return 'h-full rounded-full bg-emerald-500 transition-all'
  if (pct > 0) return 'h-full rounded-full bg-amber-500 transition-all'
  return 'h-full rounded-full bg-transparent'
}
