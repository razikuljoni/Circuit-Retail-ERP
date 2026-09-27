'use client'

// ── Code39 barcode SVG renderer + printable label sheet ─────────────────────
// Code39 is self-checking and simple enough to render as inline SVG stripes.
import { useMemo } from 'react'

// Code39 patterns: 9 elements (5 bars, 4 spaces) — 1 = wide, 0 = narrow
const CODE39: Record<string, string> = {
  '0': '101001101101', '1': '110100101011', '2': '101100101011', '3': '110110010101',
  '4': '101001101011', '5': '110100110101', '6': '101100110101', '7': '101001011011',
  '8': '110100101101', '9': '101100101101', A: '110101001011', B: '101101001011',
  C: '110110100101', D: '101011001011', E: '110101100101', F: '101101100101',
  G: '101010011011', H: '110101001101', I: '101101001101', J: '101011001101',
  K: '110101010011', L: '101101010011', M: '110110101001', N: '101011010011',
  O: '110101101001', P: '101101101001', Q: '101010110011', R: '110101011001',
  S: '101101011001', T: '101011011001', U: '110010101011', V: '100110101011',
  W: '110011010101', X: '100101101011', Y: '110010110101', Z: '100110110101',
  '-': '100101011011', '.': '110010101101', ' ': '100110101101', $: '100100100101',
  '/': '100100101001', '+': '100101001001', '%': '101001001001', '*': '100101101101',
}

function encode39(text: string): string | null {
  const chars = text.toUpperCase().split('')
  for (const c of chars) if (!CODE39[c]) return null
  const patterns = chars.map((c) => CODE39[c])
  // inter-character narrow gap
  return patterns.join('00')
}

interface BarcodeProps {
  value: string
  className?: string
  height?: number
}

/** Renders a Code39 barcode as SVG. Falls back to plain text if chars unsupported. */
export function Barcode39({ value, className, height = 44 }: BarcodeProps) {
  const { bits, ok } = useMemo(() => {
    const b = encode39(value)
    return { bits: b ?? '', ok: b !== null }
  }, [value])

  if (!ok) {
    return <div className={className}>{value}</div>
  }

  // Each bit: 1=bar, 0=space; wide ratio via run-length
  const unit = 1.6 // px per narrow module
  const rects: { x: number; w: number }[] = []
  let x = 0
  let i = 0
  while (i < bits.length) {
    let run = 1
    while (i + run < bits.length && bits[i + run] === bits[i]) run++
    if (bits[i] === '1') {
      const wide = run >= 2
      rects.push({ x, w: run * unit * (wide ? 1.05 : 1) })
    }
    x += run * unit
    i += run
  }
  const width = Math.max(x, 1)

  return (
    <svg
      role="img"
      aria-label={`Barcode ${value}`}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      preserveAspectRatio="none"
    >
      <rect x={0} y={0} width={width} height={height} fill="white" />
      {rects.map((r, idx) => (
        <rect key={idx} x={r.x} y={0} width={r.w} height={height} fill="black" />
      ))}
    </svg>
  )
}
