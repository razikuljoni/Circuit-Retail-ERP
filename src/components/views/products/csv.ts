import type { Product } from '@/lib/types'
import { dhakaDateKey } from '@/lib/format'

/** Escape a CSV cell (quotes, commas, newlines). */
function esc(v: string | number | null | undefined): string {
  const s = String(v ?? '')
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Download the (already filtered) product list as CSV with BOM for Excel. */
export function downloadProductsCsv(products: Product[]): void {
  const header = 'sku,name,category,cost,price,stock,reorder'
  const rows = products.map((p) =>
    [p.sku, p.name, p.category?.name ?? '', p.costPrice, p.price, p.stock, p.reorderLevel]
      .map(esc)
      .join(',')
  )
  const csv = '\uFEFF' + [header, ...rows].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `products-${dhakaDateKey(new Date())}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
