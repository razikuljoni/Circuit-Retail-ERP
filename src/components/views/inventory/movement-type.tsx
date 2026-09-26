'use client'

import { Badge } from '@/components/ui/badge'
import type { MovementType } from '@/lib/types'
import { cn } from '@/lib/utils'

export const MOVEMENT_LABEL: Record<MovementType, string> = {
  PURCHASE: 'Receive',
  SALE: 'Sale',
  ADJUST: 'Adjust',
  DAMAGE: 'Damage',
  RETURN: 'Return',
  REFUND: 'Refund',
}

/** Dark-mode-safe badge classes per movement type. */
export const MOVEMENT_BADGE_CLASS: Record<MovementType, string> = {
  PURCHASE: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  SALE: 'bg-secondary text-secondary-foreground border-transparent',
  ADJUST: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30',
  DAMAGE: 'bg-destructive text-white border-transparent',
  RETURN: 'border-border text-foreground',
  REFUND: 'border-border text-foreground',
}

export function MovementBadge({ type, className }: { type: MovementType; className?: string }) {
  return (
    <Badge variant="outline" className={cn(MOVEMENT_BADGE_CLASS[type], className)}>
      {MOVEMENT_LABEL[type]}
    </Badge>
  )
}
