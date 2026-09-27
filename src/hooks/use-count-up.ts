'use client'

// ── useCountUp — tween a numeric display value with ease-out ─────────────────
// Used by StatCard to make KPI numbers glide from their previous value to the
// next one whenever fresh data lands. Respects prefers-reduced-motion.
import { useEffect, useRef, useState } from 'react'

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

export function useCountUp(target: number, duration = 650): number {
  const [display, setDisplay] = useState(target)
  const displayRef = useRef(target)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const from = displayRef.current
    const delta = target - from

    const finish = (value: number) => {
      displayRef.current = value
      setDisplay(value)
    }

    // Nothing meaningful to animate (or motion is reduced) — snap on next frame.
    if (reduced || !Number.isFinite(target) || Math.abs(delta) < 0.005) {
      const id = requestAnimationFrame(() => finish(target))
      return () => cancelAnimationFrame(id)
    }

    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      finish(from + delta * easeOutCubic(t))
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [target, duration])

  return display
}
