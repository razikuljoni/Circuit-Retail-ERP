'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, PackageMinus, PackagePlus, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { api } from '@/lib/api'
import { fmtQty } from '@/lib/format'
import type { Product } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

export type AdjustType = 'PURCHASE' | 'RETURN' | 'DAMAGE' | 'ADJUST'

const TYPE_META: Record<AdjustType, { label: string; qtyLabel: string; icon: typeof PackagePlus; hint: string }> = {
  PURCHASE: {
    label: 'Receive',
    qtyLabel: 'Quantity received',
    icon: PackagePlus,
    hint: 'Adds stock in (goods received note).',
  },
  RETURN: {
    label: 'Return',
    qtyLabel: 'Quantity returned',
    icon: RotateCcw,
    hint: 'Adds stock in (e.g. customer return, resellable).',
  },
  DAMAGE: {
    label: 'Damage',
    qtyLabel: 'Quantity damaged',
    icon: PackageMinus,
    hint: 'Removes stock (damaged / expired / lost).',
  },
  ADJUST: {
    label: 'Set exact',
    qtyLabel: 'New stock count',
    icon: SlidersHorizontal,
    hint: 'Sets stock to an absolute count after a physical count.',
  },
}

export function AdjustDialog({
  open,
  onOpenChange,
  products,
  initialProductId,
  initialType,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  products: Product[]
  initialProductId?: string | null
  initialType?: AdjustType
  onDone: () => void
}) {
  const [productId, setProductId] = useState('')
  const [type, setType] = useState<AdjustType>('PURCHASE')
  const [qty, setQty] = useState('')
  const [note, setNote] = useState('')
  const [reference, setReference] = useState('')
  const [saving, setSaving] = useState(false)

  // Reset every time the dialog opens (optionally prefilled from a row action)
  useEffect(() => {
    if (!open) return
    setProductId(initialProductId ?? '')
    setType(initialType ?? 'PURCHASE')
    setQty('')
    setNote('')
    setReference('')
  }, [open, initialProductId, initialType])

  const selected = products.find((p) => p.id === productId) ?? null

  async function submit() {
    const n = Number(qty)
    if (!selected) {
      toast.error('Select a product first')
      return
    }
    if (!Number.isFinite(n) || (type === 'ADJUST' ? n < 0 : n <= 0)) {
      toast.error(type === 'ADJUST' ? 'Enter the counted stock (≥ 0)' : 'Quantity must be greater than 0')
      return
    }
    setSaving(true)
    try {
      const movement = await api.post<{ before: number; after: number }>('/api/stock/adjust', {
        productId: selected.id,
        type,
        qty: n,
        note: note.trim() || null,
        reference: reference.trim() || null,
      })
      toast.success(`${selected.name}: stock ${fmtQty(movement.before)} → ${fmtQty(movement.after)}`)
      onOpenChange(false)
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to adjust stock')
    } finally {
      setSaving(false)
    }
  }

  const Icon = TYPE_META[type].icon

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="size-4 text-primary" aria-hidden /> Stock movement
          </DialogTitle>
          <DialogDescription>{TYPE_META[type].hint}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Product</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger className="w-full" aria-label="Select product">
                <SelectValue placeholder="Choose a product…" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="flex w-full items-center justify-between gap-3">
                      <span className="truncate">
                        {p.name} <span className="font-mono text-muted-foreground">{p.sku}</span>
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">{fmtQty(p.stock)}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selected && (
              <p className="text-xs text-muted-foreground">
                Current stock:{' '}
                <span className="font-medium text-foreground tabular-nums">
                  {fmtQty(selected.stock)} {selected.unit}
                </span>
              </p>
            )}
          </div>

          <Tabs value={type} onValueChange={(v) => setType(v as AdjustType)}>
            <TabsList className="w-full grid grid-cols-4 h-9">
              <TabsTrigger value="PURCHASE" className="px-1">
                Receive
              </TabsTrigger>
              <TabsTrigger value="RETURN" className="px-1">
                Return
              </TabsTrigger>
              <TabsTrigger value="DAMAGE" className="px-1">
                Damage
              </TabsTrigger>
              <TabsTrigger value="ADJUST" className="px-1">
                Set exact
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="space-y-1.5">
            <Label htmlFor="adj-qty">{TYPE_META[type].qtyLabel} *</Label>
            <Input
              id="adj-qty"
              type="number"
              inputMode="decimal"
              min={type === 'ADJUST' ? 0 : 1}
              step={type === 'ADJUST' ? 1 : '0.01'}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="0"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="adj-ref">Reference</Label>
              <Input
                id="adj-ref"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. GRN-1042"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adj-note">Note</Label>
              <Input id="adj-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving || !productId}>
            {saving && <Loader2 className="size-4 animate-spin" aria-label="Saving" />}
            Record movement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
