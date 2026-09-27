'use client'

// ── Open-shift dialog — count the drawer float and start the shift ───────────
import { useEffect, useState } from 'react'
import { Loader2, Play } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import { fmtMoney } from '@/lib/format'
import type { Shift } from '@/lib/types'

export function ShiftOpenDialog({
  open,
  onOpenChange,
  onOpened,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpened: (shift: Shift) => void
}) {
  const [openingFloat, setOpeningFloat] = useState('0')
  const [openedBy, setOpenedBy] = useState('')
  const [note, setNote] = useState('')
  const [pending, setPending] = useState(false)

  // Fresh form every time the dialog opens
  useEffect(() => {
    if (open) {
      setOpeningFloat('0')
      setOpenedBy('')
      setNote('')
      setPending(false)
    }
  }, [open])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const float = Number(openingFloat)
    if (!Number.isFinite(float) || float < 0) {
      toast.error('Opening cash must be a number ≥ 0')
      return
    }
    setPending(true)
    try {
      const shift = await api.post<Shift>('/api/shifts', {
        openingFloat: float,
        openedBy: openedBy.trim() || undefined,
        note: note.trim() || undefined,
      })
      toast.success('Shift opened', {
        description: `Drawer starts with ${fmtMoney(shift.openingFloat)}${shift.openedBy ? ` · ${shift.openedBy}` : ''}`,
      })
      onOpened(shift)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to open shift')
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <span className="inline-flex size-6 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <Play className="size-3.5" aria-hidden />
            </span>
            Start cashier shift
          </DialogTitle>
          <DialogDescription className="text-xs">
            Count the cash in the drawer before starting. Only one shift can be open at a time.
          </DialogDescription>
        </DialogHeader>

        <form id="shift-open-form" onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="shift-opening-float">Opening cash in drawer</Label>
            <Input
              id="shift-opening-float"
              type="number"
              min={0}
              step={0.01}
              inputMode="decimal"
              value={openingFloat}
              onChange={(e) => setOpeningFloat(e.target.value)}
              placeholder="0.00"
              className="h-10 tabular-nums"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="shift-opened-by">Cashier (optional)</Label>
            <Input
              id="shift-opened-by"
              value={openedBy}
              onChange={(e) => setOpenedBy(e.target.value)}
              placeholder="Cashier name"
              maxLength={80}
              className="h-10"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="shift-open-note">Note (optional)</Label>
            <Textarea
              id="shift-open-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Anything worth remembering about this shift"
              rows={2}
              maxLength={500}
            />
          </div>
        </form>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-10"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button type="submit" form="shift-open-form" className="h-10" disabled={pending}>
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Play className="size-4" aria-hidden />
            )}
            Open shift
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
