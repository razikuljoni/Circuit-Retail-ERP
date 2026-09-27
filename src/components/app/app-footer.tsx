'use client'

// ── Sticky footer: copyright, currency chip, keyboard hints ──────────────────
import { Heart } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useUiStore } from '@/store/ui'

function KeyboardHint() {
  return (
    <div className="hidden items-center gap-1.5 text-xs text-muted-foreground md:flex" aria-hidden="true">
      <kbd className="kbd">F2</kbd>
      <span>= search</span>
      <span className="px-0.5 opacity-50">·</span>
      <kbd className="kbd">Enter</kbd>
      <span>= add</span>
      <span className="px-0.5 opacity-50">·</span>
      <kbd className="kbd">F9</kbd>
      <span>= checkout</span>
    </div>
  )
}

export function AppFooter() {
  const settings = useUiStore((s) => s.settings)

  return (
    <footer className="no-print mt-auto w-full border-t bg-background">
      <div className="flex w-full flex-col items-center justify-between gap-2 px-3 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:flex-row sm:px-5">
        <p className="text-xs text-muted-foreground">
          © <span suppressHydrationWarning>{new Date().getFullYear()}</span> Circuit Retail ERP
        </p>

        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-1 font-semibold">
            {settings.currency} {settings.currencyCode}
          </Badge>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            Made for retail
            <Heart className="size-3.5 fill-rose-500 text-rose-500" aria-hidden="true" />
          </span>
          <KeyboardHint />
        </div>
      </div>
    </footer>
  )
}
