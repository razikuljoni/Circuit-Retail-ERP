import type { SupplierStatement } from '@/lib/types'
import { dhakaDateKey } from '@/lib/format'

/** Escape a CSV cell (quotes, commas, newlines). */
function esc(v: string | number | null | undefined): string {
  const s = String(v ?? '')
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** File-safe slug for the supplier name (falls back to "supplier"). */
function slug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'supplier'
  )
}

/** Download the statement's purchase-order rows as CSV with BOM for Excel. */
export function downloadStatementCsv(statement: SupplierStatement, supplierName: string): void {
  const header = 'supplier,date,poNo,status,items,orderedQty,receivedQty,totalCost,receivedAt,note'
  const rows = statement.orders.map((o) =>
    [
      supplierName,
      dhakaDateKey(o.createdAt),
      o.poNo,
      o.status,
      o.itemCount,
      o.totalQty,
      o.receivedQty,
      o.totalCost,
      o.receivedAt ? dhakaDateKey(o.receivedAt) : '',
      o.note ?? '',
    ]
      .map(esc)
      .join(',')
  )
  const csv = '\uFEFF' + [header, ...rows].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `supplier-statement-${slug(supplierName)}-${dhakaDateKey(new Date())}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
