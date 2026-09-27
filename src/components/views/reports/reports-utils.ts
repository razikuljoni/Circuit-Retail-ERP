// ── Reports: range + CSV helpers (client-safe, no React) ────────────────────
import { addDaysUTC, dhakaDateKey } from '@/lib/format'

export type ReportType = 'pnl' | 'products' | 'daily'

/** Dhaka day key for "now". */
export function todayKey(): string {
  return dhakaDateKey(new Date())
}

/** Dhaka day key N days before today. */
export function daysAgoKey(n: number): string {
  return dhakaDateKey(addDaysUTC(new Date(), -n))
}

/** First day of the current Dhaka month. */
export function monthStartKey(): string {
  return `${todayKey().slice(0, 7)}-01`
}

/** Default report range: last 7 days ending today. */
export function defaultRange(): { from: string; to: string } {
  return { from: daysAgoKey(6), to: todayKey() }
}

/** Quick ranges offered above the date inputs. */
export const QUICK_RANGES: { key: string; label: string; range: () => { from: string; to: string } }[] = [
  { key: 'today', label: 'Today', range: () => ({ from: todayKey(), to: todayKey() }) },
  { key: '7d', label: '7d', range: () => ({ from: daysAgoKey(6), to: todayKey() }) },
  { key: '30d', label: '30d', range: () => ({ from: daysAgoKey(29), to: todayKey() }) },
  { key: 'month', label: 'This month', range: () => ({ from: monthStartKey(), to: todayKey() }) },
]

/** Which quick range (if any) matches the given from/to pair. */
export function matchQuickRange(from: string, to: string): string | null {
  for (const q of QUICK_RANGES) {
    const r = q.range()
    if (r.from === from && r.to === to) return q.key
  }
  return null
}

/** Escape a CSV cell (quotes, commas, newlines). */
function csvCell(value: string | number): string {
  const s = String(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * Build + download a CSV file. Prepends a BOM so Excel opens UTF-8 correctly.
 * Returns the number of data rows written.
 */
export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]): number {
  const lines = [headers.map(csvCell).join(','), ...rows.map((r) => r.map(csvCell).join(','))]
  const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  return rows.length
}
