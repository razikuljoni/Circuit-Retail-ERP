'use client'

// ── Thermal 80mm receipt — preview dialog + print-only clone ──────────────────
// Printing strategy: a hidden `.receipt-print-area` clone is portalled to
// <body>; on Print we tag <body> with `printing-receipt`, call window.print(),
// and the appended globals.css section shows ONLY that clone on paper.
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { Printer, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useUiStore } from '@/store/ui'
import { fmtDateTime, fmtMoney, fmtQty } from '@/lib/format'
import type { Sale } from '@/lib/types'

const subscribeNoop = () => () => {}

/** Deterministic decorative barcode-ish stripe pattern from the invoice no. */
function Barcode({ seed }: { seed: string }) {
  const bars = useMemo(() => {
    let h = 2166136261
    for (const ch of seed) {
      h ^= ch.charCodeAt(0)
      h = Math.imul(h, 16777619) >>> 0
    }
    const widths: number[] = []
    for (let i = 0; i < 42; i++) {
      h = (Math.imul(h, 1103515245) + 12345) >>> 0
      widths.push((h % 3) + 1)
    }
    return widths
  }, [seed])

  let x = 0
  const rects = bars.map((w, i) => {
    const rect = <rect key={i} x={x} y={0} width={w} height={40} fill="#000" />
    x += w + 2
    return rect
  })

  return (
    <svg
      viewBox={`0 0 ${x} 40`}
      className="mx-auto h-8 w-4/5"
      role="img"
      aria-label="Invoice barcode"
      preserveAspectRatio="none"
    >
      {rects}
    </svg>
  )
}

/**
 * 28px sale-line product snapshot — thermal-receipt sized, print-safe.
 * Renders NOTHING when there is no image or the URL is broken, so legacy
 * lines (imageUrl null) keep the exact layout they always had. Decorative:
 * the line already prints the product name as text.
 */
function LineThumb({ src }: { src: string }) {
  const [broken, setBroken] = useState(false)
  if (broken) return null
  return (
    <img
      src={src}
      alt=""
      aria-hidden
      draggable={false}
      onError={() => setBroken(true)}
      className="h-7 w-7 shrink-0 rounded border border-black/40 object-cover print:grayscale"
    />
  )
}

/** The paper itself — reused for the on-screen preview and the print clone. */
export function ReceiptPaper({ sale }: { sale: Sale }) {
  const settings = useUiStore((s) => s.settings)
  const customer = sale.customer
  const refunded = sale.status === 'REFUNDED'

  return (
    <div className="relative w-full bg-white px-3 py-4 font-mono text-[11px] leading-relaxed text-black">
      {refunded && (
        <div className="receipt-watermark pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="rotate-[-28deg] rounded-md border-4 px-4 py-1 text-2xl font-black tracking-widest">
            REFUNDED
          </span>
        </div>
      )}

      {/* Store header */}
      <div className="text-center">
        <p className="text-sm font-bold uppercase tracking-wide">{settings.storeName}</p>
        {settings.address && <p className="mt-0.5">{settings.address}</p>}
        {settings.phone && <p>Tel: {settings.phone}</p>}
      </div>

      <div className="my-2 border-t border-dashed border-black/60" />

      {/* Meta */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold">{sale.invoiceNo}</p>
          <p>{fmtDateTime(sale.createdAt)}</p>
        </div>
        <p className="text-right">
          {customer ? customer.name : 'Walk-in Customer'}
          {customer?.phone ? <span className="block">{customer.phone}</span> : null}
        </p>
      </div>

      <div className="my-2 border-t border-dashed border-black/60" />

      {/* Items */}
      <div className="space-y-1.5">
        {sale.items.map((item) => {
          const line = item.unitPrice * item.qty - item.discount
          return (
            <div key={item.id} className="flex items-center gap-1.5">
              {item.imageUrl && <LineThumb src={item.imageUrl} />}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate">
                    {fmtQty(item.qty)} × {item.name}
                  </span>
                  <span className="shrink-0 font-bold">{fmtMoney(line)}</span>
                </div>
                <div className="flex justify-between gap-2 text-[10px] opacity-70">
                  <span className="truncate">
                    {item.sku} @ {fmtMoney(item.unitPrice)}
                    {item.discount > 0 ? ` · disc ${fmtMoney(item.discount)}` : ''}
                  </span>
                  {item.tax > 0 && <span className="shrink-0">tax {fmtMoney(item.tax)}</span>}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="my-2 border-t border-dashed border-black/60" />

      {/* Totals */}
      <div className="space-y-0.5">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{fmtMoney(sale.subtotal)}</span>
        </div>
        {sale.discount > 0 && (
          <div className="flex justify-between">
            <span>Discount</span>
            <span>-{fmtMoney(sale.discount)}</span>
          </div>
        )}
        {sale.tax > 0 && (
          <div className="flex justify-between">
            <span>Tax</span>
            <span>{fmtMoney(sale.tax)}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-black/60 pt-1 text-sm font-bold">
          <span>TOTAL</span>
          <span>{fmtMoney(sale.total)}</span>
        </div>
        <div className="flex justify-between">
          <span>Paid ({sale.paymentMethod.toLowerCase()})</span>
          <span>{fmtMoney(sale.paid)}</span>
        </div>
        {(() => {
          const due = Math.max(0, sale.total - sale.paid)
          return due > 0 ? (
            <div className="flex justify-between font-bold">
              <span>DUE (CREDIT)</span>
              <span>{fmtMoney(due)}</span>
            </div>
          ) : (
            <div className="flex justify-between">
              <span>Change</span>
              <span>{fmtMoney(sale.change)}</span>
            </div>
          )
        })()}
      </div>

      {sale.note ? (
        <p className="mt-2 border-t border-dashed border-black/60 pt-2 opacity-80">Note: {sale.note}</p>
      ) : null}

      <div className="my-2 border-t border-dashed border-black/60" />

      <Barcode seed={sale.invoiceNo} />
      <p className="mt-1 text-center text-[10px] font-bold tracking-[0.35em]">{sale.invoiceNo}</p>

      {settings.receiptFooter && (
        <p className="mt-3 text-center text-[10px] opacity-80">{settings.receiptFooter}</p>
      )}
      {refunded && <p className="mt-1 text-center text-[10px] font-bold">*** REFUNDED — DO NOT HONOUR ***</p>}
      <p className="mt-2 text-center text-[10px] opacity-60">Powered by Circuit Retail ERP</p>
    </div>
  )
}

export function ReceiptDialog({ sale, onDone }: { sale: Sale | null; onDone?: () => void }) {
  // Hydration-safe mounted check (portals need a real <body>).
  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  )

  // Print: tag <body> so the print stylesheet can isolate the receipt clone.
  const handlePrint = useCallback(() => {
    if (!sale) return
    const cleanup = () => document.body.classList.remove('printing-receipt')
    document.body.classList.add('printing-receipt')
    window.addEventListener('afterprint', cleanup, { once: true })
    window.print()
  }, [sale])

  // Safety: never leave the class stuck if the dialog unmounts mid-flow.
  useEffect(() => {
    return () => document.body.classList.remove('printing-receipt')
  }, [])

  return (
    <>
      <Dialog open={!!sale} onOpenChange={(open) => { if (!open) onDone?.() }}>
        <DialogContent className="max-w-[340px] gap-3 overflow-hidden p-0">
          {sale && (
            <>
              <DialogHeader className="space-y-1 border-b px-4 py-3">
                <DialogTitle className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="size-4 text-emerald-600" aria-hidden />
                  Receipt · {sale.invoiceNo}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {sale.status === 'REFUNDED'
                    ? 'This sale was refunded — reprint for records only.'
                    : 'Sale completed successfully.'}
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-[55vh] overflow-y-auto px-3">
                <div className="overflow-hidden rounded-md border shadow-sm">
                  <ReceiptPaper sale={sale} />
                </div>
              </div>
              <DialogFooter className="flex-row gap-2 border-t px-4 py-3">
                <Button variant="outline" className="h-11 flex-1" onClick={handlePrint}>
                  <Printer className="size-4" /> Print
                </Button>
                <Button className="h-11 flex-1" onClick={() => onDone?.()}>
                  New sale
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Print-only clone at <body> level (hidden on screen, shown on paper) */}
      {mounted && sale && (
        createPortal(
          <div className="receipt-print-area" aria-hidden>
            <ReceiptPaper sale={sale} />
          </div>,
          document.body
        )
      )}
    </>
  )
}
