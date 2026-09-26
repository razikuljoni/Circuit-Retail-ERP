'use client'

// ── Printable price/label sheet with Code39 barcode ─────────────────────────
import { useState } from 'react'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Barcode39 } from '@/components/views/products/barcode39'
import { fmtMoney } from '@/lib/format'
import type { Product } from '@/lib/types'
import { Spinner } from '@/components/shared/page-bits'

const STORAGE_KEY = 'app.printing-label'

export function LabelSheet({ product, open, onOpenChange }: {
  product: Product
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const [copies, setCopies] = useState(12)
  const [printing, setPrinting] = useState(false)
  const code = product.barcode || product.sku

  const doPrint = () => {
    setPrinting(true)
    try {
      sessionStorage.setItem(STORAGE_KEY, String(copies))
      document.body.classList.add('printing-label')
      window.print()
    } finally {
      setTimeout(() => {
        document.body.classList.remove('printing-label')
        sessionStorage.removeItem(STORAGE_KEY)
        setPrinting(false)
      }, 300)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Print barcode labels</DialogTitle>
          <DialogDescription>
            Shelf / price labels with a scannable Code39 barcode ({code}).
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3">
          <label htmlFor="label-copies" className="text-sm font-medium whitespace-nowrap">Copies</label>
          <Input
            id="label-copies"
            type="number"
            min={1}
            max={60}
            value={copies}
            onChange={(e) => setCopies(Math.max(1, Math.min(60, Number(e.target.value) || 1)))}
            className="w-24"
          />
          <p className="text-xs text-muted-foreground">1–60 per sheet</p>
        </div>

        {/* Preview */}
        <div className="rounded-xl border bg-muted/30 p-4">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Preview</p>
          <div className="mx-auto w-52 rounded-md border-2 border-dashed border-border bg-white p-2 text-black shadow-sm">
            <div className="text-center">
              <p className="truncate text-[10px] font-bold uppercase leading-tight">{product.name}</p>
              <Barcode39 value={code} className="mt-1 h-10 w-full" />
              <div className="mt-0.5 flex items-baseline justify-between px-0.5">
                <span className="font-mono text-[9px]">{product.sku}</span>
                <span className="text-sm font-black leading-none">{fmtMoney(product.price)}</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={doPrint} disabled={printing}>
            {printing ? <Spinner className="mr-1.5" /> : <Printer className="size-4 mr-1.5" aria-hidden />}
            Print {copies} label{copies === 1 ? '' : 's'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
