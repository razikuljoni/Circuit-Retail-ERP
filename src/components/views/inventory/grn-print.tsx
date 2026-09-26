'use client'

// ── GRN (Goods Received Note) print — per-PO receiving document, A4 ──────────
// Shows cumulative delivery state (ordered / received / remaining) with
// signature lines, using the shared `.report-print-area` print pattern.
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useUiStore } from '@/store/ui'
import { currencySymbol, fmtDate, fmtMoney, fmtQty } from '@/lib/format'
import type { PurchaseOrder } from '@/lib/types'

export function GrnPrintButton({ po }: { po: PurchaseOrder }) {
  const storeName = useUiStore((s) => s.settings?.storeName ?? 'Circuit Store')
  const symbol = currencySymbol()

  const ordered = po.items.reduce((s, i) => s + i.qty, 0)
  const received = po.items.reduce((s, i) => s + (i.receivedQty ?? 0), 0)
  const remaining = Math.max(0, ordered - received)
  const orderValue = po.items.reduce((s, i) => s + i.qty * i.unitCost, 0)
  const receivedValue = po.items.reduce((s, i) => s + (i.receivedQty ?? 0) * i.unitCost, 0)
  const receivedAt = po.receivedAt ? fmtDate(po.receivedAt) : null

  const print = () => {
    document.body.classList.add('printing-report')
    window.print()
    setTimeout(() => document.body.classList.remove('printing-report'), 500)
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="size-8 text-muted-foreground hover:text-primary"
        aria-label={`Print GRN for ${po.poNo}`}
        title="Print goods received note (GRN)"
        onClick={print}
      >
        <Printer className="size-4" />
      </Button>

      {/* Hidden print clone — A4 */}
      <div className="report-print-area" style={{ display: 'none' }} aria-hidden>
        <div style={{ textAlign: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '0.02em' }}>{storeName}</div>
          <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>Goods Received Note (GRN)</div>
          <div style={{ fontSize: 10.5, color: '#475569' }}>
            {po.poNo} · status {po.status}
          </div>
        </div>

        <table style={{ width: '100%', fontSize: 11, marginBottom: 12, borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ padding: '2px 0', color: '#475569' }}>Supplier</td>
              <td style={{ fontWeight: 600 }}>{po.supplier?.name ?? '—'}</td>
              <td style={{ padding: '2px 0', color: '#475569' }}>PO date</td>
              <td style={{ fontWeight: 600 }}>{fmtDate(po.createdAt)}</td>
            </tr>
            <tr>
              <td style={{ padding: '2px 0', color: '#475569' }}>Deliveries received</td>
              <td style={{ fontWeight: 600 }}>
                {received > 0 ? (po.status === 'RECEIVED' ? 'Complete' : 'Partial') : 'None yet'}
                {receivedAt ? ` · last ${receivedAt}` : ''}
              </td>
              <td style={{ padding: '2px 0', color: '#475569' }}>Printed</td>
              <td style={{ fontWeight: 600 }}>
                {new Date().toLocaleString('en-GB', { timeZone: 'Asia/Dhaka' })}
              </td>
            </tr>
          </tbody>
        </table>

        <table style={{ width: '100%', fontSize: 10.5, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1.5px solid #334155' }}>
              <th style={{ textAlign: 'left', padding: '4px 6px' }}>Product</th>
              <th style={{ textAlign: 'left', padding: '4px 6px' }}>SKU</th>
              <th style={{ textAlign: 'right', padding: '4px 6px' }}>Ordered</th>
              <th style={{ textAlign: 'right', padding: '4px 6px' }}>Received</th>
              <th style={{ textAlign: 'right', padding: '4px 6px' }}>Remaining</th>
              <th style={{ textAlign: 'right', padding: '4px 6px' }}>Unit cost</th>
              <th style={{ textAlign: 'right', padding: '4px 6px' }}>Received value</th>
            </tr>
          </thead>
          <tbody>
            {po.items.map((it) => {
              const rec = it.receivedQty ?? 0
              return (
                <tr key={it.productId} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '4px 6px' }}>{it.name}</td>
                  <td style={{ padding: '4px 6px', fontFamily: 'monospace' }}>{it.sku}</td>
                  <td style={{ textAlign: 'right', padding: '4px 6px' }}>{fmtQty(it.qty)}</td>
                  <td style={{ textAlign: 'right', padding: '4px 6px', fontWeight: 600 }}>{fmtQty(rec)}</td>
                  <td style={{ textAlign: 'right', padding: '4px 6px', color: it.qty - rec > 0 ? '#b45309' : '#047857' }}>
                    {fmtQty(Math.max(0, it.qty - rec))}
                  </td>
                  <td style={{ textAlign: 'right', padding: '4px 6px' }}>{fmtMoney(it.unitCost)}</td>
                  <td style={{ textAlign: 'right', padding: '4px 6px' }}>{fmtMoney(rec * it.unitCost)}</td>
                </tr>
              )
            })}
            <tr style={{ borderTop: '1.5px solid #334155', fontWeight: 700 }}>
              <td style={{ padding: '5px 6px' }} colSpan={2}>
                Totals
              </td>
              <td style={{ textAlign: 'right', padding: '5px 6px' }}>{fmtQty(ordered)}</td>
              <td style={{ textAlign: 'right', padding: '5px 6px' }}>{fmtQty(received)}</td>
              <td style={{ textAlign: 'right', padding: '5px 6px' }}>{fmtQty(remaining)}</td>
              <td style={{ textAlign: 'right', padding: '5px 6px' }} />
              <td style={{ textAlign: 'right', padding: '5px 6px' }}>{fmtMoney(receivedValue)}</td>
            </tr>
          </tbody>
        </table>

        <div style={{ fontSize: 10, color: '#475569', marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
          <span>
            Order value {fmtMoney(orderValue)} · received so far {fmtMoney(receivedValue)} · currency {symbol}
          </span>
          <span>Circuit Retail ERP</span>
        </div>

        <div style={{ display: 'flex', gap: 48, marginTop: 36, fontSize: 10.5, color: '#334155' }}>
          <div style={{ flex: 1 }}>
            <div style={{ borderTop: '1px solid #94a3b8', paddingTop: 4 }}>Received by (name & signature)</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ borderTop: '1px solid #94a3b8', paddingTop: 4 }}>Checked by (name & signature)</div>
          </div>
        </div>
      </div>
    </>
  )
}
