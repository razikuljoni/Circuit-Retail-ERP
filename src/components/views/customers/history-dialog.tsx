'use client'

import { ReceiptText, Undo2 } from 'lucide-react'
import { useApi } from '@/hooks/use-api'
import type { Customer, SaleStatus } from '@/lib/types'
import { fmtDate, fmtMoney } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Spinner, EmptyState, ErrorState } from '@/components/shared/page-bits'

/** Shape returned by GET /api/customers/[id]. */
export interface CustomerDetail extends Customer {
  sales: { id: string; invoiceNo: string; total: number; createdAt: string; status: SaleStatus }[]
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
          <DialogDescription>Last 20 invoices, newest first.</DialogDescription>
        </DialogHeader>
        {customerId && <HistoryList customerId={customerId} />}
      </DialogContent>
    </Dialog>
  )
}

function HistoryList({ customerId }: { customerId: string }) {
  const { data, loading, error, refetch } = useApi<CustomerDetail>(`/api/customers/${customerId}`)

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
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-muted px-2 py-2.5">
          <p className="text-[11px] text-muted-foreground">Lifetime spend</p>
          <p className="text-sm font-bold tabular-nums">{fmtMoney(data?.totalSpent ?? 0)}</p>
        </div>
        <div className="rounded-lg bg-muted px-2 py-2.5">
          <p className="text-[11px] text-muted-foreground">Purchases</p>
          <p className="text-sm font-bold tabular-nums">{data?._count?.sales ?? 0}</p>
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
            {sales.map((s) => (
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
                  ) : (
                    <Badge variant="secondary">Completed</Badge>
                  )}
                  <span className="text-sm font-semibold tabular-nums">{fmtMoney(s.total)}</span>
                </div>
              </li>
            ))}
          </ul>
        </ScrollArea>
      )}
    </div>
  )
}
