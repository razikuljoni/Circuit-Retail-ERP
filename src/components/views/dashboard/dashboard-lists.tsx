'use client'

// ── Dashboard: live lists (low stock, recent transactions, recent expenses) ──
import { ArrowRight, CheckCircle2, ReceiptText, Wallet } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/page-bits'
import { fmtMoney, fmtTime } from '@/lib/format'
import type { DashboardData, Expense, Sale } from '@/lib/types'

function ListCardSkeleton({ listHeight }: { listHeight: string }) {
  return (
    <div className={`space-y-2.5 ${listHeight}`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full rounded-lg" />
      ))}
    </div>
  )
}

function ListCard({
  loading,
  title,
  description,
  count,
  footer,
  children,
}: {
  loading: boolean
  title: string
  description?: string
  count?: number
  footer?: { label: string; onClick: () => void }
  children: React.ReactNode
}) {
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          {title}
          {count !== undefined && count > 0 && <Badge variant="secondary">{count}</Badge>}
        </CardTitle>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
      </CardHeader>
      <CardContent>{loading ? <ListCardSkeleton listHeight="max-h-64" /> : children}</CardContent>
      {footer && (
        <CardFooter className="border-t pt-4">
          <Button variant="link" size="sm" className="h-8 px-0 text-xs" onClick={footer.onClick}>
            {footer.label}
            <ArrowRight className="size-3.5" aria-hidden />
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}

// ── Low stock alerts ─────────────────────────────────────────────────────────

export function LowStockCard({
  data,
  loading,
  onNavigate,
}: {
  data: DashboardData | null
  loading: boolean
  onNavigate: () => void
}) {
  const items = data?.lowStock ?? []

  return (
    <ListCard
      loading={loading}
      title="Low stock alerts"
      description="Products at or below their reorder level"
      count={items.length}
      footer={items.length > 0 ? { label: 'Open inventory', onClick: onNavigate } : undefined}
    >
      {items.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="All stocked up"
          message="Nothing is below its reorder level right now."
          className="py-8"
        />
      ) : (
        <ul className="max-h-64 space-y-1 overflow-y-auto pr-1" aria-label="Low stock products">
          {items.map((p) => {
            const out = p.stock <= 0
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={onNavigate}
                  className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span
                      className={`size-2 shrink-0 rounded-full ${out ? 'bg-red-500' : 'bg-amber-500'}`}
                      aria-hidden
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{p.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{p.sku}</span>
                    </span>
                  </span>
                  {out ? (
                    <Badge variant="destructive">Out</Badge>
                  ) : (
                    <Badge variant="secondary">Low: {p.stock}</Badge>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </ListCard>
  )
}

// ── Recent transactions ──────────────────────────────────────────────────────

export function RecentSalesCard({
  data,
  loading,
  onNavigate,
}: {
  data: DashboardData | null
  loading: boolean
  onNavigate: () => void
}) {
  const sales = data?.recentSales ?? []

  return (
    <ListCard
      loading={loading}
      title="Recent transactions"
      description="Latest invoices across all counters"
      footer={{ label: 'View all sales', onClick: onNavigate }}
    >
      {sales.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title="No transactions yet"
          message="Invoices created in POS will stream in here."
          className="py-8"
        />
      ) : (
        <ul className="max-h-80 space-y-1 overflow-y-auto pr-1" aria-label="Recent transactions">
          {sales.map((s: Sale) => {
            const refunded = s.status === 'REFUNDED'
            return (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/60"
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{s.invoiceNo}</span>
                    {refunded && <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">Refunded</Badge>}
                  </span>
                  <span className="block truncate text-sm">{s.customer?.name ?? 'Walk-in'}</span>
                </span>
                <span className="flex shrink-0 items-baseline gap-2">
                  <span className="text-xs text-muted-foreground">{fmtTime(s.createdAt)}</span>
                  <span className={`text-sm font-bold tabular-nums ${refunded ? 'line-through opacity-60' : ''}`}>
                    {fmtMoney(s.total)}
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </ListCard>
  )
}

// ── Recent expenses ──────────────────────────────────────────────────────────

export function RecentExpensesCard({
  data,
  loading,
  onNavigate,
}: {
  data: DashboardData | null
  loading: boolean
  onNavigate: () => void
}) {
  const expenses = data?.recentExpenses ?? []

  return (
    <ListCard
      loading={loading}
      title="Recent expenses"
      description="Latest costs logged against the store"
      footer={{ label: 'Manage expenses', onClick: onNavigate }}
    >
      {expenses.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No expenses logged"
          message="Track rent, salaries and supplies to keep net profit honest."
          className="py-8"
        />
      ) : (
        <ul className="max-h-80 space-y-1 overflow-y-auto pr-1" aria-label="Recent expenses">
          {expenses.map((e: Expense) => (
            <li
              key={e.id}
              className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/60"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{e.title}</span>
                <span className="mt-0.5 flex items-center gap-2">
                  {e.category ? (
                    <Badge variant="outline" className="gap-1.5 px-1.5 py-0 text-[10px] font-normal">
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: e.category.color ?? 'var(--muted-foreground)' }}
                        aria-hidden
                      />
                      {e.category.name}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-normal">
                      Uncategorized
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">{fmtTime(e.spentAt)}</span>
                </span>
              </span>
              <span className="shrink-0 text-sm font-bold tabular-nums text-red-600 dark:text-red-400">
                −{fmtMoney(e.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </ListCard>
  )
}
