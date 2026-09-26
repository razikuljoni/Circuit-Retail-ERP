'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Pencil,
  ReceiptText,
  Repeat2,
  Trash2,
  Wallet,
} from 'lucide-react'
import { api, qs } from '@/lib/api'
import { dhakaDateKey, fmtDate, fmtMoney, dayKeyToUTCStart } from '@/lib/format'
import type { Expense, ExpenseCategory } from '@/lib/types'
import { useApi } from '@/hooks/use-api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PageHeader, EmptyState, ErrorState, ViewLoader } from '@/components/shared/page-bits'
import { StatCard } from '@/components/shared/stat-card'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { ExpenseDialog } from './expenses/expense-dialog'
import { CategoryDialog } from './expenses/category-dialog'
import { TemplatesDialog } from './expenses/templates-dialog'
import { METHOD_META, METHODS } from './expenses/method-meta'
import { monthKeyOf, monthLabel, monthRange, shiftMonth } from './expenses/month-range'
import { useDebouncedValue } from './expenses/use-debounced-value'

interface ExpensesResponse {
  expenses: Expense[]
  total: number
  summary: {
    total: number
    byMethod: Record<string, number>
    byCategory: { categoryId: string | null; name: string; amount: number }[]
  }
}

export default function ExpensesView() {
  const currentMonth = monthKeyOf(new Date())
  const todayKey = dhakaDateKey(new Date())

  const [monthKey, setMonthKey] = useState(currentMonth)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const { from, to } = useMemo(() => monthRange(monthKey), [monthKey])

  const url = '/api/expenses' + qs({ from, to, search: debouncedSearch, limit: 500 })
  const { data, loading, error, refetch } = useApi<ExpensesResponse>(url)
  const catsQ = useApi<ExpenseCategory[]>('/api/expense-categories')

  const expenses = data?.expenses ?? []
  const summary = data?.summary

  // ── Stat values ──
  const todayTotal = useMemo(
    () => expenses.filter((e) => dhakaDateKey(e.spentAt) === todayKey).reduce((s, e) => s + e.amount, 0),
    [expenses, todayKey]
  )
  const topCategory = summary?.byCategory[0] ?? null

  // ── Group by day ──
  const dayGroups = useMemo(() => {
    const map = new Map<string, Expense[]>()
    for (const e of expenses) {
      const k = dhakaDateKey(e.spentAt)
      const arr = map.get(k)
      if (arr) arr.push(e)
      else map.set(k, [e])
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [expenses])

  // ── Dialog / confirm state ──
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [catsOpen, setCatsOpen] = useState(false)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null)
  const [deletePending, setDeletePending] = useState(false)

  function refetchAll() {
    refetch()
    catsQ.refetch()
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeletePending(true)
    try {
      await api.del(`/api/expenses/${deleteTarget.id}`)
      toast.success(`Expense "${deleteTarget.title}" deleted`)
      setDeleteTarget(null)
      refetch()
      catsQ.refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete expense')
    } finally {
      setDeletePending(false)
    }
  }

  if (loading && !data) return <ViewLoader />

  return (
    <div>
      <PageHeader
        icon={Wallet}
        title="Expenses"
        subtitle="Track where the money goes"
        actions={
          <>
            <Button variant="outline" onClick={() => setTemplatesOpen(true)}>
              <Repeat2 className="size-4" aria-hidden />
              Templates
            </Button>
            <Button
              onClick={() => {
                setEditing(null)
                setDialogOpen(true)
              }}
            >
              Add expense
            </Button>
          </>
        }
      />

      {error && !data ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : (
        <>
          {/* Month scope */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="inline-flex items-center rounded-lg border">
              <Button
                variant="ghost"
                size="icon"
                className="size-9 rounded-r-none"
                aria-label="Previous month"
                onClick={() => setMonthKey((m) => shiftMonth(m, -1))}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="px-3 text-sm font-semibold tabular-nums min-w-[130px] text-center">
                {monthLabel(monthKey)}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-9 rounded-l-none"
                aria-label="Next month"
                onClick={() => setMonthKey((m) => shiftMonth(m, 1))}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
            {monthKey !== currentMonth && (
              <Button variant="outline" size="sm" className="h-9" onClick={() => setMonthKey(currentMonth)}>
                <CalendarDays className="size-3.5" /> This month
              </Button>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <StatCard
              title={`${monthLabel(monthKey)} total`}
              value={fmtMoney(summary?.total ?? 0)}
              icon={Wallet}
              iconClassName="bg-red-500/10 [&_svg]:text-red-600 dark:[&_svg]:text-red-400"
            />
            <StatCard
              title="Today"
              value={fmtMoney(todayTotal)}
              icon={CalendarDays}
              hint={monthKey === currentMonth ? undefined : 'only counted in current month'}
              iconClassName="bg-amber-500/10 [&_svg]:text-amber-600 dark:[&_svg]:text-amber-400"
            />
            <StatCard
              title="Largest category"
              value={topCategory ? fmtMoney(topCategory.amount, { compact: true }) : '—'}
              icon={ReceiptText}
              hint={topCategory?.name ?? 'No expenses yet'}
              iconClassName="bg-teal-500/10 [&_svg]:text-teal-600 dark:[&_svg]:text-teal-400"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_320px] items-start">
            {/* LEFT: day-grouped list */}
            <Card>
              <CardHeader className="flex-row items-center justify-between gap-3 pb-3">
                <CardTitle className="text-base">Expenses</CardTitle>
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search title, ref, note…"
                  className="h-9 w-full sm:max-w-[220px]"
                  aria-label="Search expenses"
                />
              </CardHeader>
              <CardContent className="pt-0">
                {dayGroups.length === 0 ? (
                  <EmptyState
                    icon={ReceiptText}
                    title="No expenses this month"
                    message="Add your first expense to see it here."
                    action={
                      <Button
                        size="sm"
                        onClick={() => {
                          setEditing(null)
                          setDialogOpen(true)
                        }}
                      >
                        Add expense
                      </Button>
                    }
                  />
                ) : (
                  <div className="divide-y">
                    {dayGroups.map(([dayKey, list]) => (
                      <div key={dayKey} className="py-2 first:pt-0 last:pb-0">
                        <div className="flex items-center justify-between px-1 py-1.5">
                          <p className="text-xs font-medium text-muted-foreground">
                            {fmtDate(dayKeyToUTCStart(dayKey))}
                            {dayKey === todayKey && (
                              <Badge variant="secondary" className="ml-2">
                                Today
                              </Badge>
                            )}
                          </p>
                          <p className="text-xs font-semibold text-muted-foreground tabular-nums">
                            {fmtMoney(list.reduce((s, e) => s + e.amount, 0))}
                          </p>
                        </div>
                        <ul>
                          {list.map((e) => {
                            const Meta = METHOD_META[e.paymentMethod]
                            return (
                              <li key={e.id} className="flex items-start gap-3 rounded-lg px-2 py-2.5 hover:bg-muted/50 transition-colors">
                                <span
                                  className="mt-1.5 size-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: e.category?.color ?? '#a855f7' }}
                                  aria-hidden
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <p className="text-sm font-medium leading-tight">{e.title}</p>
                                    {e.category && (
                                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                        {e.category.name}
                                      </Badge>
                                    )}
                                  </div>
                                  {(e.reference || e.note) && (
                                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                                      {e.reference && <span className="font-mono">{e.reference}</span>}
                                      {e.reference && e.note ? ' · ' : ''}
                                      {e.note}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <div className="text-right">
                                    <p className="text-sm font-bold tabular-nums">{fmtMoney(e.amount)}</p>
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                                      <Meta.icon className="size-2.5" aria-hidden /> {Meta.label}
                                    </Badge>
                                  </div>
                                  <div className="flex flex-col sm:flex-row">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="size-8"
                                      aria-label={`Edit ${e.title}`}
                                      onClick={() => {
                                        setEditing(e)
                                        setDialogOpen(true)
                                      }}
                                    >
                                      <Pencil className="size-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="size-8 text-muted-foreground hover:text-destructive"
                                      aria-label={`Delete ${e.title}`}
                                      onClick={() => setDeleteTarget(e)}
                                    >
                                      <Trash2 className="size-3.5" />
                                    </Button>
                                  </div>
                                </div>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* RIGHT: breakdowns */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="flex-row items-center justify-between gap-3 pb-3">
                  <CardTitle className="text-base">By category</CardTitle>
                  <Button variant="outline" size="sm" className="h-8" onClick={() => setCatsOpen(true)}>
                    Manage
                  </Button>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  {(summary?.byCategory.length ?? 0) === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">Nothing tracked yet this month.</p>
                  ) : (
                    summary!.byCategory.map((c) => {
                      const share = summary && summary.total > 0 ? (c.amount / summary.total) * 100 : 0
                      const color = catsQ.data?.find((x) => x.name === c.name)?.color ?? '#a855f7'
                      return (
                        <div key={c.categoryId ?? c.name}>
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="inline-flex items-center gap-1.5 text-sm min-w-0">
                              <span className="size-2.5 rounded-full shrink-0 ring-2 ring-background" style={{ backgroundColor: color }} aria-hidden />
                              <span className="truncate font-medium">{c.name}</span>
                              <span className="text-[11px] tabular-nums text-muted-foreground shrink-0">
                                {share.toFixed(0)}%
                              </span>
                            </span>
                            <span className="text-sm font-semibold tabular-nums shrink-0">{fmtMoney(c.amount)}</span>
                          </div>
                          <div className="h-2.5 w-full rounded-full bg-muted/80 overflow-hidden shadow-inner" role="presentation">
                            <div
                              className="h-full rounded-full transition-all duration-500 shadow-sm"
                              style={{ width: `${share}%`, backgroundColor: color }}
                            />
                          </div>
                        </div>
                      )
                    })
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">By method</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  {METHODS.map((m) => {
                    const Meta = METHOD_META[m]
                    const amount = summary?.byMethod[m] ?? 0
                    return (
                      <div key={m} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
                        <span className="inline-flex items-center gap-2 text-sm">
                          <Meta.icon className="size-4 text-muted-foreground" aria-hidden />
                          {Meta.label}
                        </span>
                        <span className="text-sm font-semibold tabular-nums">{fmtMoney(amount)}</span>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}

      <ExpenseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        expense={editing}
        categories={catsQ.data ?? []}
        onSaved={refetchAll}
      />

      <CategoryDialog open={catsOpen} onOpenChange={setCatsOpen} categories={catsQ.data ?? []} onChanged={refetchAll} />

      <TemplatesDialog
        open={templatesOpen}
        onOpenChange={setTemplatesOpen}
        categories={catsQ.data ?? []}
        onPosted={refetch}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete expense?"
        message={`"${deleteTarget?.title ?? ''}" (${fmtMoney(deleteTarget?.amount ?? 0)}) will be permanently removed.`}
        confirmLabel="Delete"
        pending={deletePending}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
