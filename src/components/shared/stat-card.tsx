'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useCountUp } from '@/hooks/use-count-up'
import { type LucideIcon, TrendingDown, TrendingUp, Minus } from 'lucide-react'
import type { ReactNode } from 'react'

interface StatCardProps {
  /** Static value — omit when `animatedValue` is provided. */
  value?: ReactNode
  title: string
  icon: LucideIcon
  hint?: string
  trend?: { value: number; label?: string } // percent vs previous; +/- shows arrow
  /** When true, an INCREASE is bad (red) and a decrease is good (green) — e.g. expenses. */
  trendDownIsGood?: boolean
  iconClassName?: string
  className?: string
  /** Optional top accent bar (Tailwind bg classes), e.g. 'bg-emerald-400/70' */
  accent?: string
  /**
   * Animated numeric value — when provided, the rendered number glides from
   * its previous value to the new one. `format` receives the tweened number.
   */
  animatedValue?: { value: number; format: (n: number) => string }
  /** Optional extra classes for the big value (e.g. profit color) */
  valueClassName?: string
}

export function StatCard({ title, value, icon: Icon, hint, trend, trendDownIsGood, iconClassName, className, accent, animatedValue, valueClassName }: StatCardProps) {
  const tweened = useCountUp(animatedValue?.value ?? 0)
  const shown = animatedValue ? animatedValue.format(tweened) : value
  const trendUp = (trend?.value ?? 0) > 0
  const trendFlat = Math.abs(trend?.value ?? 0) < 0.05
  const trendGood = trendDownIsGood ? !trendUp : trendUp
  return (
    <Card className={cn('relative overflow-hidden shadow-sm hover:shadow-md transition-shadow', className)}>
      {accent && <span aria-hidden className={cn('absolute inset-x-0 top-0 h-[3px]', accent)} />}
      <CardContent className="p-3.5 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] sm:text-[13px] font-medium text-muted-foreground truncate">{title}</p>
            <div className={cn('mt-1.5 text-lg sm:text-xl 2xl:text-2xl font-bold tracking-tight tabular-nums truncate', valueClassName)} title={typeof shown === 'string' ? shown : undefined} aria-live="off">
              {shown}
            </div>
            {(hint || trend) && (
              <div className="mt-1.5 flex items-center gap-1.5 text-[11px] sm:text-xs text-muted-foreground">
                {trend && !trendFlat && (
                  <span className={cn('inline-flex items-center gap-0.5 font-medium shrink-0', trendGood ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                    {trendUp ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                    {Math.abs(trend!.value).toFixed(0)}%
                  </span>
                )}
                {trend && trendFlat && (
                  <span className="inline-flex items-center gap-0.5 text-muted-foreground shrink-0">
                    <Minus className="size-3.5" /> 0%
                  </span>
                )}
                {hint && <span className="min-w-0 whitespace-normal leading-snug">{hint}</span>}
              </div>
            )}
          </div>
          <div className={cn('rounded-xl bg-primary/10 p-2 sm:p-3 shrink-0', iconClassName)}>
            <Icon className="size-4 sm:size-5 text-primary" aria-hidden />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function StatCardSkeleton() {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="size-10 rounded-xl" />
        </div>
      </CardContent>
    </Card>
  )
}
