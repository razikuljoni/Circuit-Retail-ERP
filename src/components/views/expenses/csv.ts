import type { Expense } from '@/lib/types'
import { dhakaDateKey } from '@/lib/format'

/** Escape a CSV cell (quotes, commas, newlines). */
function esc(v: string | number | null | undefined): string {
  const s = String(v ?? '')
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * Download the (already filtered) expense list as CSV with BOM for Excel.
 * Filename mirrors the products export: expenses-{from}-to-{to}.csv when a
 * range is given, expenses-{from}.csv for a single day, expenses-{date}.csv otherwise.
 */
export function downloadExpensesCsv(expenses: Expense[], fromKey?: string, toKey?: string): void {
  const header = 'date,category,method,note,amount'
  const rows = expenses.map((e) =>
    [dhakaDateKey(e.spentAt), e.category?.name ?? '', e.paymentMethod, e.note ?? '', e.amount]
      .map(esc)
      .join(',')
  )
  const csv = '\uFEFF' + [header, ...rows].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download =
    fromKey && toKey
      ? `expenses-${fromKey}-to-${toKey}.csv`
      : fromKey
        ? `expenses-${fromKey}.csv`
        : `expenses-${dhakaDateKey(new Date())}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
