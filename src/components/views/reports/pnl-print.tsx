'use client'

// ── P&L print — ink-friendly A4 clone + print trigger ────────────────────────
// Renders a hidden .report-print-area at the end of this component; on Print
// the <body> is tagged with `printing-report` so globals.css isolates the clone.
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { currencySymbol, fmtDate, dayKeyToUTCStart, fmtMoney } from '@/lib/format'
import { useUiStore } from '@/store/ui'
import type { PnlReport } from '@/lib/types'

export function PnlPrintButton({ data, from, to }: { data: PnlReport; from: string; to: string }) {
  const storeName = useUiStore((s) => s.settings?.storeName ?? 'Circuit Store')
  const symbol = currencySymbol()

  const print = () => {
    document.body.classList.add('printing-report')
    window.print()
    setTimeout(() => document.body.classList.remove('printing-report'), 500)
  }

  const rangeLabel = `${fmtDate(dayKeyToUTCStart(from))} — ${fmtDate(dayKeyToUTCStart(to))}`
  const generated = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Dhaka' })

  const waterfall: { label: string; value: number; op: '' | '−' | '=' }[] = [
    { label: 'Revenue', value: data.revenue, op: '' },
    { label: 'Refunds', value: data.refunds, op: '−' },
    { label: 'Discounts', value: data.discounts, op: '−' },
    { label: 'Cost of goods sold', value: data.cogs, op: '−' },
    { label: 'Gross Profit', value: data.grossProfit, op: '=' },
    { label: 'Operating expenses', value: data.expensesTotal, op: '−' },
    { label: 'Net Profit', value: data.netProfit, op: '=' },
  ]

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-8"
        onClick={print}
        aria-label="Print profit and loss report"
        title="Print / save as PDF"
      >
        <Printer className="size-3.5" aria-hidden /> Print
      </Button>

      {/* Hidden print clone — inline display:none (print CSS overrides with !important) */}
      <div className="report-print-area" style={{ display: 'none' }} aria-hidden>
        <div style={{ textAlign: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '0.02em' }}>{storeName}</div>
          <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>Profit &amp; Loss Statement</div>
          <div style={{ fontSize: 10.5, color: '#475569' }}>
            {rangeLabel} · generated {generated} (Asia/Dhaka)
          </div>
        </div>

        <table style={{ marginBottom: 14 }}>
          <tbody>
            {waterfall.map((r) => (
              <tr key={r.label}>
                <td style={{ width: '60%' }}>
                  {r.op === '−' ? '\u2212 ' : r.op === '=' ? '= ' : ''}
                  {r.label}
                </td>
                <td className={`num ${r.label === 'Net Profit' ? (data.netProfit < 0 ? 'rep-negative' : '') : ''}`}>
                  {fmtMoney(r.value)}
                </td>
              </tr>
            ))}
            <tr className="rep-total">
              <td>Net margin</td>
              <td className="num">
                {data.revenue > 0 ? `${((data.netProfit / data.revenue) * 100).toFixed(1)}%` : '—'}
              </td>
            </tr>
          </tbody>
        </table>

        <div style={{ fontSize: 12, fontWeight: 700, margin: '10px 0 6px' }}>Summary</div>
        <table style={{ marginBottom: 14 }}>
          <tbody>
            <tr>
              <td>Transactions</td>
              <td className="num">{data.transactions}</td>
            </tr>
            <tr>
              <td>Average basket</td>
              <td className="num">
                {symbol}
                {data.avgBasket.toFixed(2)}
              </td>
            </tr>
            <tr>
              <td>Gross margin</td>
              <td className="num">{data.revenue > 0 ? `${((data.grossProfit / data.revenue) * 100).toFixed(1)}%` : '—'}</td>
            </tr>
          </tbody>
        </table>

        {data.expensesByCategory.length > 0 && (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, margin: '10px 0 6px' }}>Expenses by category</div>
            <table>
              <tbody>
                {data.expensesByCategory.map((c) => (
                  <tr key={c.name}>
                    <td>{c.name}</td>
                    <td className="num">{fmtMoney(c.amount)}</td>
                  </tr>
                ))}
                <tr className="rep-total">
                  <td>Total expenses</td>
                  <td className="num">{fmtMoney(data.expensesTotal)}</td>
                </tr>
              </tbody>
            </table>
          </>
        )}

        <div style={{ marginTop: 16, fontSize: 9.5, color: '#64748b', textAlign: 'center' }}>
          Figures in {symbol} ({'store-local currency'}) · Cost basis: product cost snapshot at sale time ·
          Refunds are netted against revenue.
        </div>
      </div>
    </>
  )
}
