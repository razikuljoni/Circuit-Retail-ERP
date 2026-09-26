'use client'

import { useState } from 'react'
import { ImageOff } from 'lucide-react'
import { fmtMoney } from '@/lib/format'
import type { Expense } from '@/lib/types'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

/**
 * Compact 40px receipt thumbnail for an expense row.
 * Renders nothing when the expense has no attachment; a broken image keeps the
 * button (with an ImageOff glyph) so the viewer can still explain the failure.
 *
 * Broken-image tracking stores the src that failed and compares it to the
 * current attachment — so a changed/removed attachment auto-clears the error
 * without needing a state-reset effect.
 */
export function AttachmentThumb({ expense }: { expense: Expense }) {
  const [open, setOpen] = useState(false)
  const [thumbErrorSrc, setThumbErrorSrc] = useState<string | null>(null)
  const [viewerErrorSrc, setViewerErrorSrc] = useState<string | null>(null)

  const src = expense.attachment
  const thumbBroken = thumbErrorSrc !== null && thumbErrorSrc === src
  const viewerBroken = viewerErrorSrc !== null && viewerErrorSrc === src

  if (!src) return null

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setViewerErrorSrc(null)
          setOpen(true)
        }}
        aria-label={`View receipt for ${expense.title}`}
        title={`Receipt for ${expense.title}`}
        className="size-10 shrink-0 self-center overflow-hidden rounded-md border bg-muted/40 transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {thumbBroken ? (
          <span className="flex size-10 items-center justify-center">
            <ImageOff className="size-4 text-muted-foreground" aria-hidden />
          </span>
        ) : (
          <img
            src={src}
            alt={`Receipt for ${expense.title}`}
            className="size-10 object-cover"
            onError={() => setThumbErrorSrc(src)}
          />
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-base">
              {expense.title} · {fmtMoney(expense.amount)}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Receipt attachment for {expense.title} ({fmtMoney(expense.amount)})
            </DialogDescription>
          </DialogHeader>
          {viewerBroken ? (
            <div className="flex h-48 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
              <ImageOff className="mr-2 size-4" aria-hidden />
              Receipt image could not be loaded
            </div>
          ) : (
            <img
              src={src}
              alt={`Receipt for ${expense.title}`}
              title={`Receipt for ${expense.title}`}
              className="max-h-[70vh] w-full rounded-md border object-contain"
              onError={() => setViewerErrorSrc(src)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
