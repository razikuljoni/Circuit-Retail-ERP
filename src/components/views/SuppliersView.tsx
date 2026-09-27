'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { FileText, Mail, MapPin, Pencil, Phone, Plus, StickyNote, Trash2, Truck } from 'lucide-react'
import { api, qs } from '@/lib/api'
import type { Supplier } from '@/lib/types'
import { useApi } from '@/hooks/use-api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PageHeader, EmptyState, ErrorState, ViewLoader } from '@/components/shared/page-bits'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { SupplierDialog } from './suppliers/supplier-dialog'
import { SupplierStatementDialog } from './suppliers/statement-dialog'

export default function SuppliersView() {
  const [search, setSearch] = useState('')
  const { data, loading, error, refetch } = useApi<Supplier[]>('/api/suppliers' + qs({ search }))
  const suppliers = data ?? []

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null)
  const [deletePending, setDeletePending] = useState(false)
  const [statementId, setStatementId] = useState<string | null>(null)
  const [statementName, setStatementName] = useState('')

  function openStatement(s: Supplier) {
    setStatementId(s.id)
    setStatementName(s.name)
  }

  function openCreate() {
    setEditing(null)
    setDialogOpen(true)
  }
  function openEdit(s: Supplier) {
    setEditing(s)
    setDialogOpen(true)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeletePending(true)
    try {
      await api.del(`/api/suppliers/${deleteTarget.id}`)
      toast.success(`Supplier "${deleteTarget.name}" deleted`)
      setDeleteTarget(null)
      refetch()
    } catch (e) {
      // Server blocks deletion when products reference the supplier
      toast.error(e instanceof Error ? e.message : 'Failed to delete supplier')
    } finally {
      setDeletePending(false)
    }
  }

  if (loading && !data) return <ViewLoader />

  return (
    <div>
      <PageHeader
        icon={Truck}
        title="Suppliers"
        subtitle="Who you buy from"
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Add supplier
          </Button>
        }
      />

      <div className="mb-4">
        <div className="relative sm:max-w-xs">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search suppliers…"
            className="pl-8 h-9"
            aria-label="Search suppliers"
          />
          <Truck className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" aria-hidden />
        </div>
      </div>

      {error && !data ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : suppliers.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            icon={Truck}
            title={search ? 'No suppliers match' : 'No suppliers yet'}
            message={search ? 'Try a different search.' : 'Add the vendors you purchase stock from.'}
            action={
              !search ? (
                <Button size="sm" onClick={openCreate}>
                  <Plus className="size-4" /> Add supplier
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {suppliers.map((s) => (
            <Card key={s.id} className="p-4 sm:p-5 flex flex-col gap-3 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md hover:border-primary/30">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold leading-tight truncate" title={s.name}>
                    {s.name}
                  </p>
                  <Badge variant="secondary" className="mt-1.5">
                    {s._count?.products ?? 0} {s._count?.products === 1 ? 'product' : 'products'}
                  </Badge>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                    aria-label={`Statement for ${s.name}`}
                    title="View purchase statement"
                    onClick={() => openStatement(s)}
                  >
                    <FileText className="size-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-8" aria-label={`Edit ${s.name}`} onClick={() => openEdit(s)}>
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-destructive"
                    aria-label={`Delete ${s.name}`}
                    onClick={() => setDeleteTarget(s)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5 text-sm mt-auto">
                {s.phone && (
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="size-3.5 shrink-0" aria-hidden /> {s.phone}
                  </p>
                )}
                {s.email && (
                  <p className="flex items-center gap-2 text-muted-foreground truncate">
                    <Mail className="size-3.5 shrink-0" aria-hidden />
                    <span className="truncate">{s.email}</span>
                  </p>
                )}
                {s.address && (
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="size-3.5 shrink-0" aria-hidden /> {s.address}
                  </p>
                )}
                {s.notes && (
                  <p className="flex items-start gap-2 text-muted-foreground text-xs pt-1 border-t mt-2">
                    <StickyNote className="size-3.5 shrink-0 mt-0.5" aria-hidden />
                    <span className="line-clamp-2">{s.notes}</span>
                  </p>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <SupplierDialog open={dialogOpen} onOpenChange={setDialogOpen} supplier={editing} onSaved={refetch} />

      <SupplierStatementDialog
        supplierId={statementId}
        supplierName={statementName}
        onClose={() => setStatementId(null)}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete supplier?"
        message={`"${deleteTarget?.name ?? ''}" will be removed. Suppliers with linked products cannot be deleted.`}
        confirmLabel="Delete"
        pending={deletePending}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
