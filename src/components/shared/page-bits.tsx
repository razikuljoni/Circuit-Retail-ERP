'use client'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { type LucideIcon, Loader2, RefreshCw } from 'lucide-react'
import type { ReactNode } from 'react'

/** Consistent page header: icon + title + subtitle + actions slot */
export function PageHeader({
  icon: Icon,
  title,
  subtitle,
  actions,
}: {
  icon: LucideIcon
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4 sm:mb-5">
      <div className="flex items-center gap-3 min-w-0">
        <div className="rounded-xl bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 ring-1 ring-inset ring-primary/10 p-2.5 shrink-0 shadow-xs">
          <Icon className="size-5 text-primary" aria-hidden />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold tracking-tight truncate">{title}</h1>
          {subtitle && <p className="text-xs sm:text-sm text-muted-foreground truncate">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  )
}

/** Empty state with icon + message + optional action */
export function EmptyState({
  icon: Icon,
  title,
  message,
  action,
  className,
}: {
  icon: LucideIcon
  title: string
  message?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center py-10 px-4', className)}>
      <div className="rounded-2xl bg-muted p-4 mb-3">
        <Icon className="size-8 text-muted-foreground/60" aria-hidden />
      </div>
      <p className="font-semibold text-sm">{title}</p>
      {message && <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-sm">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/** Full-view loading skeleton: header row + card grid */
export function ViewLoader({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="size-11 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
        </div>
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-xl" style={{ opacity: 0.5 + rows * 0 }} />
    </div>
  )
}

/** Inline error banner with retry */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 py-10 px-4 text-center">
      <p className="text-sm font-medium text-destructive">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="size-3.5 mr-1.5" /> Try again
        </Button>
      )}
    </div>
  )
}

/** Tiny loading button content helper */
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-4 animate-spin', className)} aria-label="Loading" />
}
