'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Save, ImageOff, ImagePlus, X } from 'lucide-react'
import { api } from '@/lib/api'
import { dhakaDateKey, dayKeyToUTCStart, startOfDayUTC, toDateInputValue } from '@/lib/format'
import type { Expense, ExpenseCategory, PaymentMethod } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { METHODS, METHOD_META } from './method-meta'

const EMPTY_METHOD: PaymentMethod = 'CASH'

export function ExpenseDialog({
  open,
  onOpenChange,
  expense,
  categories,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  expense: Expense | null
  categories: ExpenseCategory[]
  onSaved: () => void
}) {
  const isEdit = expense !== null
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('none')
  const [method, setMethod] = useState<PaymentMethod>(EMPTY_METHOD)
  const [dateKey, setDateKey] = useState(() => toDateInputValue(new Date()))
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [attachment, setAttachment] = useState('')
  const [attachmentBroken, setAttachmentBroken] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (expense) {
      setTitle(expense.title)
      setAmount(String(expense.amount))
      setCategoryId(expense.categoryId ?? 'none')
      setMethod(expense.paymentMethod)
      setDateKey(toDateInputValue(expense.spentAt))
      setReference(expense.reference ?? '')
      setNote(expense.note ?? '')
      setAttachment(expense.attachment ?? '')
    } else {
      setTitle('')
      setAmount('')
      setCategoryId('none')
      setMethod(EMPTY_METHOD)
      setDateKey(toDateInputValue(new Date()))
      setReference('')
      setNote('')
      setAttachment('')
    }
    setAttachmentBroken(false)
  }, [open, expense])

  async function submit() {
    const trimmed = title.trim()
    const amt = Number(amount)
    if (!trimmed) {
      toast.error('Title is required')
      return
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error('Amount must be greater than 0')
      return
    }

    // Light client-side shape check (server enforces the same rule)
    const att = attachment.trim()
    if (att && !/^(https?:\/\/.+|data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,[\s\S]+)$/i.test(att)) {
      toast.error('Attachment must be an http(s) or data:image URL')
      return
    }

    // Day-key (Dhaka) → UTC instant, keeping the current time-of-day for today
    let spentAt: Date
    if (dateKey === dhakaDateKey(new Date())) {
      spentAt = new Date()
    } else if (isEdit && expense) {
      const orig = new Date(expense.spentAt)
      const timeOfDay = orig.getTime() - startOfDayUTC(orig).getTime()
      spentAt = new Date(dayKeyToUTCStart(dateKey).getTime() + timeOfDay)
    } else {
      spentAt = new Date(dayKeyToUTCStart(dateKey).getTime() + 12 * 3600 * 1000) // noon Dhaka
    }

    setSaving(true)
    try {
      const payload = {
        title: trimmed,
        amount: amt,
        categoryId: categoryId === 'none' ? null : categoryId,
        paymentMethod: method,
        spentAt: spentAt.toISOString(),
        reference: reference.trim() || null,
        note: note.trim() || null,
        attachment: att || null, // '' → null (also clears an existing attachment on edit)
      }
      if (isEdit) {
        await api.put(`/api/expenses/${expense.id}`, payload)
        toast.success(`Expense "${trimmed}" updated`)
      } else {
        await api.post('/api/expenses', payload)
        toast.success(`Expense "${trimmed}" added`)
      }
      onOpenChange(false)
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save expense')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit expense' : 'Add expense'}</DialogTitle>
          <DialogDescription>Track where the money goes — every taka counts.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="e-title">Title *</Label>
            <Input
              id="e-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Shop rent, Generator fuel"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="e-amount">Amount *</Label>
              <Input
                id="e-amount"
                type="number"
                inputMode="decimal"
                min={0.01}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-date">Date</Label>
              <Input id="e-date" type="date" value={dateKey} onChange={(e) => setDateKey(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="w-full" aria-label="Expense category">
                  <SelectValue placeholder="No category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No category</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Method</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                <SelectTrigger className="w-full" aria-label="Payment method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => {
                    const Meta = METHOD_META[m]
                    return (
                      <SelectItem key={m} value={m}>
                        <span className="inline-flex items-center gap-2">
                          <Meta.icon className="size-3.5 text-muted-foreground" aria-hidden /> {Meta.label}
                        </span>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="e-ref">Reference</Label>
            <Input
              id="e-ref"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Receipt / voucher no."
              className="font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="e-note">Note</Label>
            <Textarea id="e-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional details" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="e-attachment">Receipt attachment</Label>
            <div className="flex items-start gap-3">
              {attachment && !attachmentBroken ? (
                <img
                  src={attachment}
                  alt="Receipt preview"
                  className="size-14 shrink-0 rounded-md border object-cover"
                  onError={() => setAttachmentBroken(true)}
                />
              ) : (
                <span className="flex size-14 shrink-0 items-center justify-center rounded-md border border-dashed bg-muted/30">
                  {attachmentBroken ? (
                    <ImageOff className="size-5 text-muted-foreground" aria-hidden />
                  ) : (
                    <ImagePlus className="size-5 text-muted-foreground" aria-hidden />
                  )}
                </span>
              )}
              <div className="min-w-0 flex-1 space-y-1">
                <Input
                  id="e-attachment"
                  value={attachment}
                  onChange={(e) => {
                    setAttachment(e.target.value)
                    setAttachmentBroken(false)
                  }}
                  placeholder="https://… or data:image…"
                  className="font-mono text-xs"
                  autoComplete="off"
                />
                <div className="flex min-h-[28px] items-center justify-between gap-2">
                  <p className="text-[11px] text-muted-foreground">
                    {attachment && attachmentBroken
                      ? 'Invalid image URL'
                      : 'Optional receipt photo — shown as a thumbnail on the expense row.'}
                  </p>
                  {attachment && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 shrink-0 px-2 text-xs text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        setAttachment('')
                        setAttachmentBroken(false)
                      }}
                    >
                      <X className="size-3" aria-hidden /> Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" aria-label="Saving" /> : <Save className="size-4" />}
            {isEdit ? 'Save changes' : 'Add expense'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
