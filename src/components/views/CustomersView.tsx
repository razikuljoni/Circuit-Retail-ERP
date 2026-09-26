'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  AlarmClock,
  Download,
  HandCoins,
  History,
  Mail,
  MoreVertical,
  Pencil,
  Phone,
  Plus,
  Trash2,
  Users,
} from 'lucide-react'
import { api, qs } from '@/lib/api'
import { fmtDate, fmtMoney } from '@/lib/format'
import type { Customer } from '@/lib/types'
import { useApi } from '@/hooks/use-api'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { PageHeader, EmptyState, ErrorState, ViewLoader } from '@/components/shared/page-bits'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { useDebouncedValue } from './customers/use-debounced-value'
import { downloadCustomersCsv } from './customers/csv'
import { CustomerDialog } from './customers/customer-dialog'
import { HistoryDialog } from './customers/history-dialog'
import { AgingDialog } from './customers/aging-dialog'

/** Deterministic soft avatar tint per name (dark-mode safe, no blue/indigo). */
const AVATAR_TONES = [
  'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  'bg-rose-500/15 text-rose-700 dark:text-rose-400',
  'bg-teal-500/15 text-teal-700 dark:text-teal-400',
  'bg-violet-500/15 text-violet-700 dark:text-violet-400',
  'bg-orange-500/15 text-orange-700 dark:text-orange-400',
  'bg-lime-500/15 text-lime-700 dark:text-lime-400',
  'bg-pink-500/15 text-pink-700 dark:text-pink-400',
] as const

function avatarTone(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_TONES[h % AVATAR_TONES.length]
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function CustomersView() {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const { data, loading, error, refetch } = useApi<Customer[]>(
    '/api/customers' + qs({ search: debouncedSearch })
  )
  const customers = data ?? []

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [historyId, setHistoryId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null)
  const [deletePending, setDeletePending] = useState(false)
  const [settlingId, setSettlingId] = useState<string | null>(null)
  const [agingOpen, setAgingOpen] = useState(false)

  const totalOutstanding = customers.reduce((sum, c) => sum + (c.totalDue ?? 0), 0)

  async function settleAll(c: Customer) {
    setSettlingId(c.id)
    try {
      const res = await api.post<{ settledCount: number; settledTotal: number }>(
        `/api/customers/${c.id}/settle-all`
      )
      toast.success(`Settled ${res.settledCount} invoice${res.settledCount === 1 ? '' : 's'} for ${c.name}`, {
        description: `${fmtMoney(res.settledTotal)} collected`,
      })
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to settle dues')
    } finally {
      setSettlingId(null)
    }
  }

  function openCreate() {
    setEditing(null)
    setDialogOpen(true)
  }
  function openEdit(c: Customer) {
    setEditing(c)
    setDialogOpen(true)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeletePending(true)
    try {
      await api.del(`/api/customers/${deleteTarget.id}`)
      toast.success(`Customer "${deleteTarget.name}" deleted`)
      setDeleteTarget(null)
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete customer')
    } finally {
      setDeletePending(false)
    }
  }

  if (loading && !data) return <ViewLoader />

  return (
    <div>
      <PageHeader
        icon={Users}
        title="Customers"
        subtitle="Profiles and purchase history"
        actions={
          <>
            <Button
              variant="outline"
              disabled={customers.length === 0}
              aria-label="Export customers as CSV"
              onClick={() => downloadCustomersCsv(customers)}
            >
              <Download className="size-4" aria-hidden />
              <span className="hidden sm:inline">Export CSV</span>
              <span className="sm:hidden">CSV</span>
            </Button>
            <Button variant="outline" onClick={() => setAgingOpen(true)}>
              <AlarmClock className="size-4" />
              <span className="hidden sm:inline">Aging</span>
              {totalOutstanding > 0 && (
                <Badge
                  variant="outline"
                  className="ml-1 border-amber-500/40 bg-amber-500/10 px-1.5 text-[10px] font-bold text-amber-700 dark:text-amber-400"
                >
                  {fmtMoney(totalOutstanding, { compact: true })}
                </Badge>
              )}
            </Button>
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              Add customer
            </Button>
          </>
        }
      />

      <div className="mb-4">
        <div className="relative sm:max-w-xs">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or phone…"
            className="pl-8 h-9"
            aria-label="Search customers"
          />
          <Users className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" aria-hidden />
        </div>
      </div>

      {error && !data ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : customers.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            icon={Users}
            title={search ? 'No customers match' : 'No customers yet'}
            message={search ? 'Try a different name or phone number.' : 'Add walk-in regulars to track their purchases.'}
            action={
              !search ? (
                <Button size="sm" onClick={openCreate}>
                  <Plus className="size-4" /> Add customer
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {customers.map((c) => (
            <Card key={c.id} className="p-4 sm:p-5 flex flex-col gap-3 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-start gap-3">
                <Avatar className="size-10">
                  <AvatarFallback className={`text-sm font-semibold ${avatarTone(c.name)}`}>
                    {initials(c.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-tight truncate" title={c.name}>
                    {c.name}
                  </p>
                  {c.phone ? (
                    <p className="inline-flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <Phone className="size-3 shrink-0" aria-hidden /> {c.phone}
                    </p>
                  ) : c.email ? (
                    <p className="inline-flex items-center gap-1 text-xs text-muted-foreground mt-0.5 truncate">
                      <Mail className="size-3 shrink-0" aria-hidden /> {c.email}
                    </p>
                  ) : null}
                  {((c.totalDue ?? 0) > 0 || c.creditLimit != null) && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pr-7">
                      {(c.totalDue ?? 0) > 0 && (
                        <Badge className="border border-amber-500/40 bg-amber-500/10 text-[10px] font-bold text-amber-700 dark:text-amber-400" variant="outline">
                          DUE {fmtMoney(c.totalDue ?? 0)}
                        </Badge>
                      )}
                      {c.creditLimit != null && (c.totalDue ?? 0) > 0 && (
                        <Badge
                          className={`border text-[10px] font-bold ${
                            (c.totalDue ?? 0) >= c.creditLimit
                              ? 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400'
                              : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                          }`}
                          variant="outline"
                        >
                          LIMIT {fmtMoney(Math.max(0, c.creditLimit - (c.totalDue ?? 0)), { compact: true })} LEFT
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-8" aria-label={`Actions for ${c.name}`}>
                      <MoreVertical className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEdit(c)}>
                      <Pencil className="size-3.5" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setHistoryId(c.id)}>
                      <History className="size-3.5" /> History
                    </DropdownMenuItem>
                    {(c.totalDue ?? 0) > 0 && (
                      <DropdownMenuItem
                        className="text-emerald-600 focus:text-emerald-600 dark:text-emerald-400 dark:focus:text-emerald-400"
                        disabled={settlingId === c.id}
                        onClick={() => void settleAll(c)}
                      >
                        <HandCoins className="size-3.5" /> Settle dues ({fmtMoney(c.totalDue ?? 0)})
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteTarget(c)}>
                      <Trash2 className="size-3.5" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex items-end justify-between gap-2 mt-auto">
                <div>
                  <Badge variant="secondary">{c._count?.sales ?? 0} purchases</Badge>
                  {c.creditLimit != null && (
                    <Badge variant="outline" className="ml-1 text-[10px] text-muted-foreground">
                      limit {fmtMoney(c.creditLimit, { compact: true })}
                    </Badge>
                  )}
                  {c.lastPurchaseAt && (
                    <p className="text-[11px] text-muted-foreground mt-1.5">Last: {fmtDate(c.lastPurchaseAt)}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-base font-bold tabular-nums">{fmtMoney(c.totalSpent ?? 0)}</p>
                  <p className="text-[11px] text-muted-foreground">total spent</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <CustomerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        customer={editing}
        onSaved={refetch}
      />

      <HistoryDialog
        customerId={historyId}
        customerName={customers.find((c) => c.id === historyId)?.name ?? 'Customer'}
        onClose={() => setHistoryId(null)}
      />

      <AgingDialog open={agingOpen} onClose={() => setAgingOpen(false)} />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete customer?"
        message={`"${deleteTarget?.name ?? ''}" will be removed. Their past invoices remain, just without this customer attached.`}
        confirmLabel="Delete"
        pending={deletePending}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
