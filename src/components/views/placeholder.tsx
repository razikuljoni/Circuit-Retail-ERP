'use client'

// ── Temporary placeholder view (Tasks 4–6 replace these with real modules) ──
import type { LucideIcon } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

interface PlaceholderViewProps {
  icon: LucideIcon
  title: string
  subtitle?: string
}

export default function PlaceholderView({ icon: Icon, title, subtitle }: PlaceholderViewProps) {
  return (
    <div className="mx-auto w-full max-w-3xl animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Empty-state card */}
      <div className="rounded-xl border bg-card p-8 text-center shadow-xs">
        <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-6" aria-hidden="true" />
        </div>
        <h2 className="pt-4 text-lg font-semibold tracking-tight">{title}</h2>
        <p className="mx-auto max-w-sm pt-1 text-sm text-muted-foreground">
          {subtitle ?? 'Coming in next build phase — this module is already wired into the shell.'}
        </p>
        <div className="flex justify-center pt-4">
          <span className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-2 animate-ping rounded-full bg-primary opacity-40" />
              <span className="relative inline-flex size-2 rounded-full bg-primary" />
            </span>
            Coming in next build phase
          </span>
        </div>
      </div>

      {/* Skeleton shimmer of upcoming content */}
      <div className="grid gap-4 pt-6 sm:grid-cols-3" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl border bg-card p-5 shadow-xs">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-6 w-24" />
            <div className="space-y-2 pt-4">
              <Skeleton className="h-2.5 w-full" />
              <Skeleton className="h-2.5 w-4/5" />
            </div>
          </div>
        ))}
      </div>
      <Skeleton className="mt-4 h-24 w-full rounded-xl" aria-hidden="true" />
    </div>
  )
}
