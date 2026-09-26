'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Palette, Plus, Trash2 } from 'lucide-react'
import { api } from '@/lib/api'
import { fmtMoney } from '@/lib/format'
import type { ExpenseCategory } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'

export function CategoryDialog({
  open,
  onOpenChange,
  categories,
  onChanged,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: ExpenseCategory[]
  onChanged: () => void
}) {
  const [name, setName] = useState('')
  const [color, setColor] = useState('#10b981')
  const [adding, setAdding] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ExpenseCategory | null>(null)
  const [deletePending, setDeletePending] = useState(false)

  useEffect(() => {
    if (!open) {
      setName('')
      setColor('#10b981')
    }
  }, [open])

  async function addCategory() {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error('Category name is required')
      return
    }
    setAdding(true)
    try {
      await api.post('/api/expense-categories', { name: trimmed, color })
      toast.success(`Category "${trimmed}" added`)
      setName('')
      onChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add category')
    } finally {
      setAdding(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeletePending(true)
    try {
      await api.del(`/api/expense-categories/${deleteTarget.id}`)
      toast.success(`Category "${deleteTarget.name}" deleted`)
      setDeleteTarget(null)
      onChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete category')
    } finally {
      setDeletePending(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Palette className="size-4 text-primary" aria-hidden /> Expense categories
            </DialogTitle>
            <DialogDescription>Organize spending with colored categories.</DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-64 -mx-2 px-2">
            <div className="space-y-1">
              {categories.length === 0 && <p className="text-sm text-muted-foreground py-3 text-center">No categories yet.</p>}
              {categories.map((c) => (
                <div key={c.id} className="flex items-center gap-2.5 rounded-lg border px-3 py-2">
                  <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color ?? '#a855f7' }} aria-hidden />
                  <span className="text-sm font-medium flex-1 truncate">{c.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{fmtMoney(c.monthTotal ?? 0)}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-destructive"
                    aria-label={`Delete category ${c.name}`}
                    onClick={() => setDeleteTarget(c)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>

          <form
            className="flex items-center gap-2 border-t pt-4"
            onSubmit={(e) => {
              e.preventDefault()
              void addCategory()
            }}
          >
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="New category name"
              className="flex-1 h-9"
              aria-label="Category name"
            />
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="size-9 rounded-md border border-input bg-transparent cursor-pointer"
              aria-label="Category color"
              title="Category color"
            />
            <Button type="submit" size="sm" className="h-9" disabled={adding}>
              {adding ? <Loader2 className="size-4 animate-spin" aria-label="Adding" /> : <Plus className="size-4" />}
              Add
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete category?"
        message={`"${deleteTarget?.name ?? ''}" will be removed. Categories with recorded expenses cannot be deleted.`}
        confirmLabel="Delete"
        pending={deletePending}
        onConfirm={confirmDelete}
      />
    </>
  )
}
