// ── Server-side helpers shared by API routes ──
import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { dayKeyToUTCStart, dayKeyToUTCEnd, addDaysUTC, startOfTodayUTC, dhakaDateKey } from './format'

/** Round to 2 decimals (money) */
export function round2(n: number): number {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100
}

/** JSON error response */
export function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status })
}

/** First readable message from a ZodError */
export function zodMsg(e: ZodError): string {
  return e.issues
    .map((i) => `${i.path.length ? i.path.join('.') : 'input'}: ${i.message}`)
    .join('; ')
}

/** YYYY-MM-DD check */
export function isDayKey(s: string | null | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s)
}

/** Number query param with default + NaN guard */
export function numParam(v: string | null | undefined, def: number): number {
  if (v === null || v === undefined || v === '') return def
  const n = Number(v)
  return Number.isFinite(n) ? n : def
}

/** Prisma unique-constraint check */
export function isUniqueError(e: unknown): boolean {
  return (
    typeof e === 'object' &&
    e !== null &&
    'code' in e &&
    (e as { code?: string }).code === 'P2002'
  )
}

/** Build a UTC [start, end) range from optional Dhaka day keys; falls back to N days ago → today */
export function dayRangeFromKeys(
  from: string | null | undefined,
  to: string | null | undefined,
  defaultDaysBack = 29
): { start: Date; end: Date; fromKey: string; toKey: string } {
  const todayKey = dhakaDateKey(startOfTodayUTC())
  const fromKey = isDayKey(from) ? from : dhakaDateKey(addDaysUTC(startOfTodayUTC(), -defaultDaysBack))
  const toKey = isDayKey(to) ? to : todayKey
  const start = dayKeyToUTCStart(fromKey)
  const end = dayKeyToUTCEnd(toKey) // exclusive end (start of day after `to`)
  return { start, end, fromKey, toKey }
}

/** All Dhaka day keys between two UTC instants (inclusive of both days), ascending */
export function dayKeysBetween(start: Date, end: Date): string[] {
  const keys: string[] = []
  let cursor = dayKeyToUTCStart(dhakaDateKey(start))
  const lastKey = dhakaDateKey(new Date(end.getTime() - 1)) // inclusive last day
  // safety cap of 400 iterations
  for (let i = 0; i < 400; i++) {
    const key = dhakaDateKey(cursor)
    keys.push(key)
    if (key >= lastKey) break
    cursor = addDaysUTC(cursor, 1)
  }
  return keys
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** '26 Sep' label from a YYYY-MM-DD key */
export function dayKeyLabel(key: string): string {
  const [, m, d] = key.split('-').map(Number)
  return `${d} ${MONTHS[m - 1]}`
}

/** '10 AM' style hour label */
export function hourLabel(h: number): string {
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12} ${h < 12 ? 'AM' : 'PM'}`
}

/** Dhaka hour-of-day (0-23) for a UTC instant */
export function dhakaHour(d: Date): number {
  return new Date(d.getTime() + 6 * 3600 * 1000).getUTCHours()
}

/**
 * Gap-safe document sequence: max existing sequence for a prefix (e.g.
 * "INV-20260927-" over ["INV-20260927-0003", …]) → highest number found.
 * Count-based sequencing collides once rows are deleted (poNo unique violation);
 * max+1 stays correct regardless of gaps.
 */
export function maxSeqOf(prefix: string, numbers: string[]): number {
  let max = 0
  for (const no of numbers) {
    if (!no.startsWith(prefix)) continue
    const n = Number(no.slice(prefix.length))
    if (Number.isFinite(n) && n > max) max = n
  }
  return max
}

/** Next zero-padded document number for a prefix (max + 1, gap-safe). */
export function nextDocNumber(prefix: string, numbers: string[], pad = 4): string {
  return `${prefix}${String(maxSeqOf(prefix, numbers) + 1).padStart(pad, '0')}`
}

/** Validate a product image URL: http(s) URL or data:image URI, capped length. */
export function isValidImageUrl(u: string): boolean {
  if (u.length > 300_000) return false // ~300KB data-URI cap
  return /^https?:\/\/.+/i.test(u) || /^data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,[\s\S]+$/i.test(u)
}
