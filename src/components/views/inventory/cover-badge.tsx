'use client'

import { cn } from '@/lib/utils'
import { fmtNum } from '@/lib/format'
import type { Product } from '@/lib/types'

/** Days-of-stock-cover chip: red ≤3d, amber ≤7d, green beyond, muted when no sales velocity. */
export function CoverBadge({ product, className }: { product: Product; className?: string }) {
  const cover = product.daysCover
  if (cover === null || cover === undefined) {
    return (
      <span className={cn('inline-flex items-center text-[11px] text-muted-foreground/70', className)}>
        no recent sales
      </span>
    )
  }
  const urgent = cover <= 3
  const soon = cover <= 7
  return (
    <span
      title={`Selling ≈${fmtNum(product.avgDailyQty ?? 0, 1)}/day — about ${fmtNum(cover, 1)} days of stock left`}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums',
        urgent
          ? 'bg-red-500/10 text-red-600 dark:text-red-400'
          : soon
            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
        className
      )}
    >
      ≈ {fmtNum(cover, cover < 10 ? 1 : 0)}d left
    </span>
  )
}
