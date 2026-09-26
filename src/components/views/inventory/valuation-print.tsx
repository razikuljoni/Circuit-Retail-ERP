'use client'

// ── Inventory valuation print — ink-friendly A4 stock valuation sheet ───────
// Clone of the product list with cost/retail values, using the shared
// `.report-print-area` pattern (body gets `printing-report` while printing).
import { useMemo } from 'react'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { currencySymbol, fmtDateTime, fmtMoney, fmtQty } from '@/lib/format'
import { useUiStore } from '@/store/ui'
import type { Product } from '@/lib/types'

export function ValuationPrintButton({ products }: { products: Product[] }) {
  const storeName = useUiStore((s) => s.settings?.storeName ?? 'Circuit Store')
  const symbol = currencySymbol()

  const rows = useMemo(
    () =>
      products
        .map((p) => ({
          sku: p.sku,
          name: p.name,
          category: p.category?.name ?? '—',
          supplier: p.supplier?.name ?? '—',
          stock: p.stock,
          unit: p.unit,
          costPrice: p.costPrice,
          price: p.price,
          costValue: p.stock * p.costPrice,
          retailValue: p.stock * p.price,
        }))
        .sort((a, b) => b.costValue - a.costValue),
    [products]
  )

  const totals = useMemo(
    () => ({
      units: rows.reduce((s, r) => s + r.stock, 0),
      cost: rows.reduce((s, r) => s + r.costValue, 0),
      retail: rows.reduce((s, r) => s + r.retailValue, 0),
      low: products.filter((p) => p.stock > 0 && p.stock <= p.reorderLevel).length,
      out: products.filter((p) => p.stock <= 0).length,
    }),
    [rows, products]
  )

  const potentialMargin = totals.cost > 0 ? ((totals.retail - totals.cost) / totals.cost) * 100 : null
  const generated = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Dhaka' })

  const print = () => {
    document.body.classList.add('printing-report')
    window.print()
    setTimeout(() => document.body.classList.remove('printing-report'), 500)
  }

  return (
    <>
      <Button
        variant="outline"
        className="h-9"
        onClick={print}
        disabled={products.length === 0}
        aria-label="Print stock valuation report"
        title="Print / save stock valuation as PDF"
      >
        <Printer className="size-4" />
        <span className="hidden sm:inline">Valuation</span>
      </Button>

      {/* Hidden print clone — A4 */}
      <div className="report-print-area" style={{ display: 'none' }} aria-hidden>
        <div style={{ textAlign: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '0.02em' }}>{storeName}</div>
          <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>Stock Valuation Report</div>
          <div style={{ fontSize: 10.5, color: '#475569' }}>
            {rows.length} products · generated {generated} (Asia/Dhaka)
          </div>
        </div>

        <table style={{ marginBottom: 14 }}>
          <tbody>
            <tr>
              <td>Total units in stock</td>
              <td className="num">{totals.units}</td>
            </tr>
            <tr>
              <td>Stock value at cost</td>
              <td className="num">{fmtMoney(totals.cost)}</td>
            </tr>
            <tr>
              <td>Stock value at retail</td>
              <td className="num">{fmtMoney(totals.retail)}</td>
            </tr>
            <tr className="rep-total">
              <td>Potential margin</td>
              <td className="num">{potentialMargin !== null ? `${potentialMargin.toFixed(1)}%` : '—'}</td>
            </tr>
            <tr>
              <td>Low stock / out of stock</td>
              <td className="num">
                {totals.low} / {totals.out}
              </td>
            </tr>
          </tbody>
        </table>

        <div style={{ fontSize: 12, fontWeight: 700, margin: '10px 0 6px' }}>
          Valuation by product (sorted by value at cost)
        </div>
        <table>
          <thead>
            <tr>
              <th style={{ width: '10%' }}>SKU</th>
              <th>Name</th>
              <th style={{ width: '13%' }}>Category</th>
              <th className="num" style={{ width: '7%' }}>Stock</th>
              <th className="num" style={{ width: '10%' }}>Cost</th>
              <th className="num" style={{ width: '10%' }}>Price</th>
              <th className="num" style={{ width: '13%' }}>Value (cost)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.sku}>
                <td>{r.sku}</td>
                <td>{r.name}</td>
                <td>{r.category}</td>
                <td className="num">
                  {fmtQty(r.stock)} {r.unit}
                </td>
                <td className="num">{fmtMoney(r.costPrice)}</td>
                <td className="num">{fmtMoney(r.price)}</td>
                <td className="num">{fmtMoney(r.costValue)}</td>
              </tr>
            ))}
            <tr className="rep-total">
              <td colSpan={3}>Totals — {rows.length} products</td>
              <td className="num">{totals.units}</td>
              <td colSpan={2} />
              <td className="num">{fmtMoney(totals.cost)}</td>
            </tr>
          </tbody>
        </table>

        <div style={{ marginTop: 16, fontSize: 9.5, color: '#64748b', textAlign: 'center' }}>
          Figures in {symbol} · Values computed from current stock × current cost/retail prices ·
          Active products only.
        </div>
      </div>
    </>
  )
}
