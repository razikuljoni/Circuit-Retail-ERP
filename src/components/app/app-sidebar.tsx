'use client'

// ── Sidebar: desktop sticky aside + mobile Sheet drawer ──────────────────────
import { Store } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { NavList } from '@/components/app/nav-list'
import { useUiStore } from '@/store/ui'

/** Small store-profile card pinned to the bottom of the sidebar. */
function StoreProfileCard() {
  const settings = useUiStore((s) => s.settings)
  return (
    <div className="border-t p-3">
      <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Store className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium leading-tight">{settings.storeName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {settings.currency} {settings.currencyCode} · Dhaka
          </p>
        </div>
      </div>
    </div>
  )
}

export function AppSidebar() {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen)
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen)

  return (
    <>
      {/* Desktop aside — sticky below the header */}
      <aside
        className={[
          'no-print hidden w-60 shrink-0 flex-col border-r bg-background',
          'sticky top-14 self-start lg:flex h-[calc(100vh-3.5rem)]',
          'sm:top-16 sm:h-[calc(100vh-4rem)]',
        ].join(' ')}
        aria-label="Sidebar navigation"
      >
        <NavList className="flex-1 overflow-y-auto p-3 pb-4" />
        <StoreProfileCard />
      </aside>

      {/* Mobile drawer */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent id="mobile-nav" side="left" className="w-72 gap-0 p-0">
          <SheetHeader className="border-b p-4">
            <SheetTitle className="flex items-center gap-2.5 text-base">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Store className="size-4" aria-hidden="true" />
              </span>
              Circuit Retail ERP
            </SheetTitle>
            <SheetDescription>Inventory · POS · Expenses · Reports</SheetDescription>
          </SheetHeader>
          <NavList
            className="flex-1 overflow-y-auto p-3 pb-4"
            onNavigate={() => setSidebarOpen(false)}
          />
          <StoreProfileCard />
        </SheetContent>
      </Sheet>
    </>
  )
}
