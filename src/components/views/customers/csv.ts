import type { Customer } from '@/lib/types'
import { dhakaDateKey } from '@/lib/format'

/** Escape a CSV cell (quotes, commas, newlines). */
function esc(v: string | number | null | undefined): string {
  const s = String(v ?? '')
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Download the (already filtered) customer list as CSV with BOM for Excel. */
export function downloadCustomersCsv(customers: Customer[]): void {
  const header = 'name,phone,email,orders,totalSpent,totalDue,creditLimit,lastPurchaseAt'
  const rows = customers.map((c) =>
    [
      c.name,
      c.phone ?? '',
      c.email ?? '',
      c._count?.sales ?? 0,
      c.totalSpent ?? 0,
      c.totalDue ?? 0,
      c.creditLimit ?? '',
      c.lastPurchaseAt ? dhakaDateKey(c.lastPurchaseAt) : '',
    ]
      .map(esc)
      .join(',')
  )
  const csv = '\uFEFF' + [header, ...rows].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `customers-${dhakaDateKey(new Date())}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
