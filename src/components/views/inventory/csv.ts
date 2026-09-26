import type { StockMovement } from '@/lib/types'
import { dhakaDateKey } from '@/lib/format'

function esc(v: string | number | null | undefined): string {
  const s = String(v ?? '')
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Download the movement ledger as CSV with BOM. */
export function downloadMovementsCsv(movements: StockMovement[]): void {
  const header = 'date,product,sku,type,qty,before,after,reference,note'
  const rows = movements.map((m) =>
    [
      new Date(m.createdAt).toISOString(),
      m.product?.name ?? '',
      m.product?.sku ?? '',
      m.type,
      m.qty,
      m.before,
      m.after,
      m.reference ?? '',
      m.note ?? '',
    ]
      .map(esc)
      .join(',')
  )
  const csv = '\uFEFF' + [header, ...rows].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `stock-movements-${dhakaDateKey(new Date())}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
