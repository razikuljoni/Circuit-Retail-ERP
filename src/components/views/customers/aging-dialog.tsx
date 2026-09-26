'use client'

// Receivables aging report dialog — buckets outstanding dues by invoice age.
import { AlarmClock, Loader2, Wallet } from 'lucide-react'
import { fmtDateTime, fmtMoney } from '@/lib/format'
import type { AgingReport } from '@/lib/types'
import { useApi } from '@/hooks/use-api'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState } from '@/components/shared/page-bits'

function cell(v: number): React.ReactNode {
  return v > 0 ? (
    <span className="tabular-nums font-medium">{fmtMoney(v)}</span>
  ) : (
    <span className="text-muted-foreground/40">—</span>
  )
}

export function AgingDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, loading, error } = useApi<AgingReport>(open ? '/api/customers/aging' : null)

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[88vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlarmClock className="size-4.5 text-primary" />
            Receivables aging
          </DialogTitle>
          <DialogDescription>
            Outstanding dues bucketed by invoice age — chase the oldest first.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-14">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="py-8 text-center text-sm text-destructive">{error}</p>
        ) : !data || data.rows.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="No outstanding dues"
            message="Every credit sale is fully settled — nothing to age."
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold">
                Total due {fmtMoney(data.totalDue)}
              </Badge>
              <Badge variant="secondary">
                {data.customersWithDues} customer{data.customersWithDues === 1 ? '' : 's'}
              </Badge>
              <span className="text-xs text-muted-foreground ml-auto">
                as of {fmtDateTime(data.generatedAt)}
              </span>
            </div>

            <div className="rounded-lg border overflow-y-auto min-h-0">
              <Table>
                <TableHeader className="sticky top-0 bg-muted/90 backdrop-blur z-10">
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Current ≤30</TableHead>
                    <TableHead className="text-right">31–60</TableHead>
                    <TableHead className="text-right">61–90</TableHead>
                    <TableHead className="text-right">90+</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Oldest</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((r) => (
                    <TableRow key={r.customerId}>
                      <TableCell>
                        <p className="font-medium leading-tight">{r.name}</p>
                        {r.phone && <p className="text-xs text-muted-foreground">{r.phone}</p>}
                      </TableCell>
                      <TableCell className="text-right">{cell(r.buckets.c30)}</TableCell>
                      <TableCell className="text-right text-amber-600 dark:text-amber-400">{cell(r.buckets.c60)}</TableCell>
                      <TableCell className="text-right text-orange-600 dark:text-orange-400">{cell(r.buckets.c90)}</TableCell>
                      <TableCell className="text-right text-red-600 dark:text-red-400">{cell(r.buckets.c90plus)}</TableCell>
                      <TableCell className="text-right font-bold tabular-nums">{fmtMoney(r.totalDue)}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                        {r.oldestDays === 0 ? 'today' : `${r.oldestDays}d`}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        <div className="mt-4 flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
