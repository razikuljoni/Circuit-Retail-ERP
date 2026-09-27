// ── Dhaka calendar month helpers for the expenses month scope ──

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const

/** 'YYYY-MM' day-key prefix of a Date, in Dhaka. */
export function monthKeyOf(d: Date): string {
  return new Date(d.getTime() + 6 * 3600 * 1000).toISOString().slice(0, 7)
}

export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7)
}

/** 'September 2025' style label. */
export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return `${MONTH_NAMES[m - 1] ?? key} ${y}`
}

/** Day-key range ('YYYY-MM-DD') covering the whole Dhaka month. */
export function monthRange(key: string): { from: string; to: string } {
  const [y, m] = key.split('-').map(Number)
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { from: `${key}-01`, to: `${key}-${String(lastDay).padStart(2, '0')}` }
}
