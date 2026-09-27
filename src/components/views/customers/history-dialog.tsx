'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { BadgeCheck, HandCoins, ReceiptText, Undo2 } from 'lucide-react'
import { api } from '@/lib/api'
import { useApi } from '@/hooks/use-api'
import type { Customer, SaleStatus } from '@/lib/types'
import { fmtDate, fmtMoney } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Spinner, EmptyState, ErrorState } from '@/components/shared/page-bits'

/** Shape returned by GET /api/customers/[id]. */
export interface CustomerDetail extends Customer {
  sales: {
    id: string
    invoiceNo: string
    total: number
    paid: number
    createdAt: string
    status: SaleStatus
    due?: number
  }[]
}

export function HistoryDialog({
  customerId,
  customerName,
  onClose,
}: {
  customerId: string | null
  customerName: string
  onClose: () => void
}) {
  return (
    <Dialog open={customerId !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Purchase history — {customerName}</DialogTitle>
          <DialogDescription>Last 20 invoices, newest first. Settle outstanding credit per invoice.</DialogDescription>
        </DialogHeader>
        {customerId && <HistoryList customerId={customerId} />}
      </DialogContent>
    </Dialog>
  )
}

function HistoryList({ customerId }: { customerId: string }) {
  const { data, loading, error, refetch } = useApi<CustomerDetail>(`/api/customers/${customerId}`)
  const [settlingId, setSettlingId] = useState<string | null>(null)

  async function settle(saleId: string, invoiceNo: string) {
    setSettlingId(saleId)
    try {
      const updated = await api.post<{ settledNow: number }>(`/api/sales/${saleId}/settle`, {
        amount: Number.MAX_SAFE_INTEGER, // settle remaining — server caps at outstanding
      })
      toast.success(`Payment recorded for ${invoiceNo}`, {
        description: `${fmtMoney(updated.settledNow)} collected`,
      })
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to settle invoice')
    } finally {
      setSettlingId(null)
    }
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-10">
        <Spinner className="size-5" />
      </div>
    )
  }
  if (error) return <ErrorState message={error} onRetry={refetch} />

  const sales = data?.sales ?? []

  return (
    <div className="space-y-3">
      {/* Mini-stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
        <div className="rounded-lg bg-muted px-2 py-2.5">
          <p className="text-[11px] text-muted-foreground">Lifetime spend</p>
          <p className="text-sm font-bold tabular-nums">{fmtMoney(data?.totalSpent ?? 0)}</p>
        </div>
        <div className="rounded-lg bg-muted px-2 py-2.5">
          <p className="text-[11px] text-muted-foreground">Purchases</p>
          <p className="text-sm font-bold tabular-nums">{data?._count?.sales ?? 0}</p>
        </div>
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-2 py-2.5">
          <p className="text-[11px] text-amber-700 dark:text-amber-400">Outstanding due</p>
          <p className="text-sm font-bold tabular-nums text-amber-700 dark:text-amber-400">
            {fmtMoney(data?.totalDue ?? 0)}
          </p>
        </div>
        <div className="rounded-lg bg-muted px-2 py-2.5">
          <p className="text-[11px] text-muted-foreground">Last purchase</p>
          <p className="text-sm font-bold">{data?.lastPurchaseAt ? fmtDate(data.lastPurchaseAt) : '—'}</p>
        </div>
      </div>
      <Separator />

      {sales.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title="No purchases yet"
          message="This customer hasn't made a purchase."
        />
      ) : (
        <ScrollArea className="max-h-72 -mx-2 px-2">
          <ul className="space-y-1.5">
            {sales.map((s) => {
              const due = s.status === 'COMPLETED' ? (s.due ?? 0) : 0
              return (
                <li key={s.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-medium truncate">{s.invoiceNo}</p>
                    <p className="text-[11px] text-muted-foreground">{fmtDate(s.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {s.status === 'REFUNDED' ? (
                      <Badge variant="outline" className="text-amber-700 dark:text-amber-400 border-amber-500/40">
                        <Undo2 className="size-2.5" aria-hidden /> Refunded
                      </Badge>
                    ) : due > 0 ? (
                      <Badge
                        variant="outline"
                        className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                      >
                        Due {fmtMoney(due)}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-emerald-700 dark:text-emerald-400">
                        <BadgeCheck className="size-2.5" aria-hidden /> Paid
                      </Badge>
                    )}
                    <span className="text-sm font-semibold tabular-nums">{fmtMoney(s.total)}</span>
                    {due > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 border-emerald-500/40 px-2 text-[11px] hover:bg-emerald-500/10"
                        disabled={settlingId === s.id}
                        onClick={() => void settle(s.id, s.invoiceNo)}
                      >
                        {settlingId === s.id ? <Spinner className="size-3" /> : <HandCoins className="size-3" />}
                        Settle
                      </Button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </ScrollArea>
      )}
    </div>
  )
}
