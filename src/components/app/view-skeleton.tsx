'use client'

// ── Branded Suspense fallback for lazily loaded views ────────────────────────
import { Skeleton } from '@/components/ui/skeleton'
import { Store } from 'lucide-react'

export function ViewSkeleton() {
  return (
    <div className="mx-auto w-full max-w-7xl animate-in fade-in duration-300" role="status" aria-label="Loading view">
      {/* Page title bar */}
      <div className="flex items-center gap-3 pb-6">
        <Skeleton className="flex size-9 items-center justify-center rounded-lg">
          <Store className="size-4 text-muted-foreground/50" />
        </Skeleton>
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-64 max-w-[60vw]" />
        </div>
      </div>

      {/* KPI / content cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl border bg-card p-5 shadow-xs">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-7 w-32" />
            <Skeleton className="mt-4 h-2.5 w-20" />
          </div>
        ))}
      </div>

      <p className="pt-6 text-center text-xs tracking-wide text-muted-foreground">
        Loading Circuit…
      </p>
    </div>
  )
}
