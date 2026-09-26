'use client'

// ── Bulk printable label sheet — one dialog for N selected products ─────────
// Screen: scrollable preview grid of label tiles + a global "copies per
// product" input with a computed total. Print: the established body-class +
// sessionStorage pattern (mirrors label-sheet.tsx) with a hidden
// .bulk-label-print-area clone portalled to <body> (same as sales/receipt.tsx)
// so the print CSS can isolate it from all dialog chrome.
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Printer, Tags } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Barcode39 } from '@/components/views/products/barcode39'
import { fmtMoney } from '@/lib/format'
import type { Product } from '@/lib/types'
import { Spinner } from '@/components/shared/page-bits'

const STORAGE_KEY = 'app.printing-bulk-labels'
const MIN_COPIES = 1
const MAX_COPIES = 24
const DEFAULT_COPIES = 12 // matches the single-product LabelSheet default

/** One shelf/price label tile — visually identical to the single-label preview. */
function LabelTile({ product }: { product: Product }) {
  const code = product.barcode || product.sku
  return (
    <div className="bulk-label-cell w-full rounded-md border-2 border-dashed border-border bg-white p-2 text-black">
      <p className="truncate text-center text-[10px] font-bold uppercase leading-tight" title={product.name}>
        {product.name}
      </p>
      <Barcode39 value={code} className="mt-1 h-10 w-full" />
      <div className="mt-0.5 flex items-baseline justify-between gap-1 px-0.5">
        <span className="truncate font-mono text-[9px]">{product.sku}</span>
        <span className="whitespace-nowrap text-sm font-black leading-none">{fmtMoney(product.price)}</span>
      </div>
    </div>
  )
}

export function BulkLabelSheet({ products, open, onOpenChange }: {
  products: Product[]
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const [copies, setCopies] = useState(DEFAULT_COPIES)
  const [printing, setPrinting] = useState(false)

  const count = products.length
  const total = copies * count

  const setCopiesClamped = (raw: string) => {
    const n = Number(raw)
    setCopies(Math.max(MIN_COPIES, Math.min(MAX_COPIES, Number.isFinite(n) ? n : MIN_COPIES)))
  }

  const doPrint = () => {
    setPrinting(true)
    try {
      sessionStorage.setItem(STORAGE_KEY, String(copies))
      document.body.classList.add('printing-bulk-labels')
      window.print()
    } finally {
      setTimeout(() => {
        document.body.classList.remove('printing-bulk-labels')
        sessionStorage.removeItem(STORAGE_KEY)
        setPrinting(false)
      }, 300)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tags className="size-4 text-primary" aria-hidden />
              Print barcode labels — {count} product{count === 1 ? '' : 's'}
            </DialogTitle>
            <DialogDescription>
              Shelf / price labels with scannable Code39 barcodes (product barcode, or SKU when blank).
            </DialogDescription>
          </DialogHeader>

          {/* Copies per product + computed total */}
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="bulk-copies" className="text-sm font-medium whitespace-nowrap">
              Copies per product
            </label>
            <Input
              id="bulk-copies"
              type="number"
              min={MIN_COPIES}
              max={MAX_COPIES}
              value={copies}
              onChange={(e) => setCopiesClamped(e.target.value)}
              className="w-20"
              aria-label="Copies per product"
            />
            <p className="text-xs text-muted-foreground">1–24 per product</p>
            <span
              className="ml-auto inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 tabular-nums dark:text-emerald-400"
              aria-live="polite"
            >
              {total} label{total === 1 ? '' : 's'} total
            </span>
          </div>

          {/* Preview grid — scrollable for many products */}
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Preview · {count} product{count === 1 ? '' : 's'} × {copies} cop{copies === 1 ? 'y' : 'ies'}
            </p>
            <div className="max-h-[50vh] overflow-y-auto rounded-xl border bg-muted/30 p-3">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {products.map((p) => (
                  <LabelTile key={p.id} product={p} />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={doPrint} disabled={printing}>
              {printing ? <Spinner className="mr-1.5" /> : <Printer className="size-4 mr-1.5" aria-hidden />}
              Print {total} label{total === 1 ? '' : 's'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hidden print clone — portalled to <body> (hidden on screen; print CSS
          isolates + re-displays it while body.printing-bulk-labels is set). */}
      {createPortal(
        <div className="bulk-label-print-area" style={{ display: 'none' }} aria-hidden>
          <div className="bulk-label-grid">
            {products.flatMap((p) =>
              Array.from({ length: copies }, (_, i) => (
                <LabelTile key={`${p.id}-copy-${i + 1}`} product={p} />
              )),
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
