'use client'

// ── Shift guard — intercepts checkout when no cashier shift is open ──────────
// Rendered by PosView beside its own CheckoutDialog. Flow:
//   checkout attempt (no shift) → guard confirm → embedded ShiftOpenDialog
//   → onShiftOpened (PosView auto-resumes the pending checkout)
// This is the guard's OWN ShiftOpenDialog instance (shift-bar renders another
// one independently); Radix only mounts open dialog content, so there are no
// duplicate id/aria conflicts — at most one of them is ever open.
// The cart is never touched here; PosView owns the pendingCheckout ref.
import { useRef, useState } from 'react'
import { AlertTriangle, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { Shift } from '@/lib/types'
import { ShiftOpenDialog } from './shift-open-dialog'

export function ShiftGuardDialog({
  open,
  onOpenChange,
  onShiftOpened,
  onAborted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Fired after a shift is successfully opened through this flow. */
  onShiftOpened: (shift: Shift) => void
  /** Fired when the cashier backs out (guard cancel, or cancel mid open-shift). */
  onAborted?: () => void
}) {
  // Step 2: the real open-shift form, kept separate so the guard and the form
  // are never on screen at the same time.
  const [formOpen, setFormOpen] = useState(false)
  // Distinguishes "form closed after a successful open" (onOpened fired first)
  // from a plain cancel, so onAborted only fires on genuine back-outs.
  const openedRef = useRef(false)
  // True while advancing guard → form, so closing the guard this way is not
  // reported as an abort.
  const advancingRef = useRef(false)

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!o && !advancingRef.current) onAborted?.()
          advancingRef.current = false
          onOpenChange(o)
        }}
      >
        <DialogContent className="max-w-sm gap-4" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <span className="inline-flex size-6 items-center justify-center rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="size-3.5" aria-hidden />
              </span>
              No shift is open
            </DialogTitle>
            <DialogDescription className="text-xs">
              Cash sales should land in a counted drawer. Start a shift and count the opening cash — your
              cart stays exactly as it is and checkout resumes automatically.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" className="h-10" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              className="h-10 font-semibold"
              onClick={() => {
                advancingRef.current = true
                onOpenChange(false)
                setFormOpen(true)
              }}
              aria-label="Start a shift, then resume checkout"
            >
              <Play className="size-4" aria-hidden /> Start shift
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ShiftOpenDialog
        open={formOpen}
        onOpenChange={(o) => {
          if (!o) {
            setFormOpen(false)
            if (openedRef.current) {
              openedRef.current = false // success — onShiftOpened already fired
            } else {
              onAborted?.()
            }
          } else {
            setFormOpen(true)
          }
        }}
        onOpened={(shift) => {
          openedRef.current = true
          onShiftOpened(shift)
        }}
      />
    </>
  )
}
