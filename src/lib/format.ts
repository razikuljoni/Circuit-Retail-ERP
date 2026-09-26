// ── Formatting helpers (Asia/Dhaka, currency from settings) ──

export const TZ = 'Asia/Dhaka'

let CURRENCY = '৳'
export function setCurrencySymbol(sym: string) {
  if (sym) CURRENCY = sym
}
export function currencySymbol() {
  return CURRENCY
}

export function fmtMoney(n: number | null | undefined, opts?: { compact?: boolean; symbol?: boolean }) {
  const v = Number(n ?? 0)
  const symbol = opts?.symbol === false ? '' : CURRENCY
  if (opts?.compact && Math.abs(v) >= 100000) {
    return `${symbol}${(v / 100000).toFixed(v % 100000 === 0 ? 0 : 1)}L`
  }
  if (opts?.compact && Math.abs(v) >= 1000) {
    return `${symbol}${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`
  }
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(v))
  return `${symbol}${v < 0 ? '-' : ''}${formatted}`
}

/** Whole-taka money — for dense KPI cards where decimals cause truncation */
export function fmtMoneyInt(n: number | null | undefined) {
  const v = Math.round(Number(n ?? 0))
  const formatted = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.abs(v))
  return `${CURRENCY}${v < 0 ? '-' : ''}${formatted}`
}

export function fmtNum(n: number | null | undefined, digits = 0) {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(n ?? 0))
}

export function fmtQty(n: number | null | undefined) {
  const v = Number(n ?? 0)
  return Number.isInteger(v) ? fmtNum(v) : fmtNum(v, 2)
}

export function fmtPercent(n: number | null | undefined, digits = 1) {
  return `${Number(n ?? 0).toFixed(digits)}%`
}

// Date helpers in Asia/Dhaka (UTC+6, no DST)
export function dhakaNow(): Date {
  const now = new Date()
  return new Date(now.getTime() + 6 * 3600 * 1000)
}

/** Start of today in Dhaka, as a real UTC Date object for DB queries */
export function startOfTodayUTC(): Date {
  const now = new Date()
  const dhakaMs = now.getTime() + 6 * 3600 * 1000
  const dhakaDayStart = Math.floor(dhakaMs / 86400000) * 86400000
  return new Date(dhakaDayStart - 6 * 3600 * 1000)
}

export function startOfDayUTC(d: Date | string): Date {
  const dt = typeof d === 'string' ? new Date(d) : d
  const dhakaMs = dt.getTime() + 6 * 3600 * 1000
  const dhakaDayStart = Math.floor(dhakaMs / 86400000) * 86400000
  return new Date(dhakaDayStart - 6 * 3600 * 1000)
}

export function addDaysUTC(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86400000)
}

/** 'YYYY-MM-DD' in Dhaka for a given UTC instant */
export function dhakaDateKey(d: Date | string): string {
  const dt = typeof d === 'string' ? new Date(d) : d
  return new Date(dt.getTime() + 6 * 3600 * 1000).toISOString().slice(0, 10)
}

/** Human time like "02:45 PM" for a UTC instant, Dhaka zone */
export function fmtTime(d: Date | string): string {
  const dt = typeof d === 'string' ? new Date(d) : d
  const s = new Date(dt.getTime() + 6 * 3600 * 1000).toISOString().slice(11, 16)
  const [h, m] = s.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`
}

/** Human date like "26 Sep 2025" */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export function fmtDate(d: Date | string): string {
  const dt = typeof d === 'string' ? new Date(d) : d
  const iso = new Date(dt.getTime() + 6 * 3600 * 1000).toISOString()
  const [y, m, day] = iso.slice(0, 10).split('-').map(Number)
  return `${day} ${MONTHS[m - 1]} ${y}`
}

export function fmtDateTime(d: Date | string): string {
  return `${fmtDate(d)}, ${fmtTime(d)}`
}

/** Input value for <input type="date"> given a UTC instant, in Dhaka */
export function toDateInputValue(d: Date | string): string {
  return dhakaDateKey(d)
}

/** Convert a 'YYYY-MM-DD' (Dhaka calendar day) to UTC start-of-day Date */
export function dayKeyToUTCStart(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d) - 6 * 3600 * 1000)
}

export function dayKeyToUTCEnd(key: string): Date {
  const start = dayKeyToUTCStart(key)
  return new Date(start.getTime() + 86400000)
}
