'use client'

// ── Expense templates — recurring expense blueprints, one click to post ──────
// Manage templates (title/category/amount/method/frequency) and post a real
// expense for today straight from the list.
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  CalendarClock,
  CalendarDays,
  Loader2,
  Pencil,
  Plus,
  RefreshCcw,
  Repeat2,
  Send,
  Trash2,
  X,
} from 'lucide-react'
import { api } from '@/lib/api'
import { fmtDate, fmtMoney } from '@/lib/format'
import type { ExpenseCategory, ExpenseFrequency, ExpenseTemplate } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { EmptyState } from '@/components/shared/page-bits'
import { METHOD_META, METHODS } from './method-meta'
import { cn } from '@/lib/utils'

const FREQ_LABEL: Record<ExpenseFrequency, string> = {
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
}

interface FormState {
  id: string | null
  title: string
  categoryId: string
  amount: string
  paymentMethod: 'CASH' | 'CARD' | 'MOBILE' | 'BANK'
  frequency: ExpenseFrequency
}

const EMPTY_FORM: FormState = { id: null, title: '', categoryId: '', amount: '', paymentMethod: 'CASH', frequency: 'MONTHLY' }

export function TemplatesDialog({
  open,
  onOpenChange,
  categories,
  onPosted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: ExpenseCategory[]
  onPosted: () => void
}) {
  const [templates, setTemplates] = useState<ExpenseTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formOpen, setFormOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [postingId, setPostingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ExpenseTemplate | null>(null)
  const [deletePending, setDeletePending] = useState(false)

  const catsById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  async function load() {
    setLoading(true)
    try {
      setTemplates(await api.get<ExpenseTemplate[]>('/api/expense-templates'))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load templates')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      load()
      setForm(EMPTY_FORM)
      setFormOpen(false)
    }
  }, [open])

  async function submitForm() {
    const amount = Number(form.amount)
    if (!form.title.trim()) {
      toast.error('Give the template a title')
      return
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter an amount greater than 0')
      return
    }
    setSaving(true)
    try {
      const body = {
        title: form.title.trim(),
        categoryId: form.categoryId || null,
        amount,
        paymentMethod: form.paymentMethod,
        frequency: form.frequency,
      }
      if (form.id) {
        await api.put(`/api/expense-templates/${form.id}`, body)
        toast.success(`Template "${body.title}" updated`)
      } else {
        await api.post('/api/expense-templates', body)
        toast.success(`Template "${body.title}" created`)
      }
      setForm(EMPTY_FORM)
      setFormOpen(false)
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save template')
    } finally {
      setSaving(false)
    }
  }

  async function postTemplate(t: ExpenseTemplate) {
    setPostingId(t.id)
    try {
      await api.post(`/api/expense-templates/${t.id}/post`)
      toast.success(`Expense posted — "${t.title}" ${fmtMoney(t.amount)}`, {
        description: 'It is now included in today\u2019s expenses and net profit.',
      })
      load()
      onPosted()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to post expense')
    } finally {
      setPostingId(null)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeletePending(true)
    try {
      await api.del(`/api/expense-templates/${deleteTarget.id}`)
      toast.success(`Template "${deleteTarget.title}" deleted`)
      setDeleteTarget(null)
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete template')
    } finally {
      setDeletePending(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Repeat2 className="size-4 text-primary" aria-hidden /> Recurring expense templates
            </DialogTitle>
            <DialogDescription>
              Save rent, salaries, utility bills and other repeating costs as templates — then post each one with a
              single click when it is due.
            </DialogDescription>
          </DialogHeader>

          {/* Inline create/edit form */}
          {formOpen ? (
            <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{form.id ? 'Edit template' : 'New template'}</p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label="Close form"
                  onClick={() => {
                    setForm(EMPTY_FORM)
                    setFormOpen(false)
                  }}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="tpl-title">Title *</Label>
                  <Input
                    id="tpl-title"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Shop rent — Uttara branch"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tpl-amount">Amount (৳) *</Label>
                  <Input
                    id="tpl-amount"
                    type="number"
                    inputMode="decimal"
                    min={1}
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    placeholder="0"
                    className="h-9 text-right tabular-nums"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <Select value={form.categoryId} onValueChange={(v) => setForm((f) => ({ ...f, categoryId: v }))}>
                    <SelectTrigger className="h-9 w-full" aria-label="Template category">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
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
                  <Select
                    value={form.paymentMethod}
                    onValueChange={(v) => setForm((f) => ({ ...f, paymentMethod: v as FormState['paymentMethod'] }))}
                  >
                    <SelectTrigger className="h-9 w-full" aria-label="Payment method">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {METHODS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {METHOD_META[m].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Frequency</Label>
                  <Select
                    value={form.frequency}
                    onValueChange={(v) => setForm((f) => ({ ...f, frequency: v as ExpenseFrequency }))}
                  >
                    <SelectTrigger className="h-9 w-full" aria-label="Frequency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(FREQ_LABEL) as ExpenseFrequency[]).map((f) => (
                        <SelectItem key={f} value={f}>
                          {FREQ_LABEL[f]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setForm(EMPTY_FORM)
                    setFormOpen(false)
                  }}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button size="sm" onClick={submitForm} disabled={saving}>
                  {saving && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
                  {form.id ? 'Save changes' : 'Create template'}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full border-dashed"
              onClick={() => {
                setForm(EMPTY_FORM)
                setFormOpen(true)
              }}
            >
              <Plus className="size-4" aria-hidden /> New template
            </Button>
          )}

          {/* Template list */}
          <div className="-mr-2 max-h-[38vh] overflow-y-auto pr-2" aria-label="Template list">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
              </div>
            ) : templates.length === 0 ? (
              <EmptyState
                icon={CalendarClock}
                title="No templates yet"
                message="Create one for rent, salaries or the internet bill — recurring costs become one-click posts."
              />
            ) : (
              <ul className="divide-y rounded-lg border">
                {templates.map((t) => {
                  const Meta = METHOD_META[t.paymentMethod]
                  const color = t.category?.color ?? catsById.get(t.categoryId ?? '')?.color
                  return (
                    <li key={t.id} className={cn('flex items-center gap-3 px-3 py-2.5', !t.active && 'opacity-55')}>
                      <span
                        className="size-2.5 shrink-0 rounded-full ring-2 ring-background"
                        style={{ backgroundColor: color ?? 'var(--muted-foreground)' }}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="truncate text-sm font-medium leading-tight">{t.title}</p>
                          <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                            <CalendarDays className="size-2.5" aria-hidden /> {FREQ_LABEL[t.frequency]}
                          </Badge>
                          {t.category && (
                            <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                              {t.category.name}
                            </Badge>
                          )}
                        </div>
                        <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <Meta.icon className="size-2.5" aria-hidden /> {Meta.label}
                          {t.lastPostedAt ? (
                            <>
                              {' · '}last posted {fmtDate(t.lastPostedAt)}
                            </>
                          ) : (
                            ' · never posted'
                          )}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-bold tabular-nums">{fmtMoney(t.amount)}</p>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                          aria-label={`Post "${t.title}" as today's expense`}
                          disabled={postingId === t.id}
                          onClick={() => postTemplate(t)}
                        >
                          {postingId === t.id ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-3.5" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label={`Edit ${t.title}`}
                          onClick={() => {
                            setForm({
                              id: t.id,
                              title: t.title,
                              categoryId: t.categoryId ?? '',
                              amount: String(t.amount),
                              paymentMethod: t.paymentMethod,
                              frequency: t.frequency,
                            })
                            setFormOpen(true)
                          }}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-destructive"
                          aria-label={`Delete ${t.title}`}
                          onClick={() => setDeleteTarget(t)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <p className="flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground">
            <RefreshCcw className="mt-0.5 size-3 shrink-0" aria-hidden />
            <span>
              Posting creates a real expense for today (reference{' '}
              <span className="whitespace-nowrap font-mono">TPL:{'<title>'}</span>) and stamps the template&apos;s
              last-posted date.
            </span>
          </p>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete template?"
        message={`"${deleteTarget?.title ?? ''}" (${fmtMoney(deleteTarget?.amount ?? 0)}) will be removed. Expenses already posted from it are not affected.`}
        confirmLabel="Delete"
        pending={deletePending}
        onConfirm={confirmDelete}
      />
    </>
  )
}
