// ── Deterministic color for chips/dots derived from a name ──
// Avoids blue/indigo per design rules; safe on light + dark backgrounds.

const PALETTE = [
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#14b8a6', // teal
  '#8b5cf6', // violet
  '#f97316', // orange
  '#84cc16', // lime
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#a855f7', // purple
] as const

export function hashColor(key: string): string {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}
