'use client'

// ── App shell (single visible route) ─────────────────────────────────────────
// Header + sidebar/drawer + lazily-loaded view + sticky footer.
// The active view is synced to the URL hash (e.g. #/pos) so refreshes persist.
import { Suspense, lazy, useEffect } from 'react'
import type { ComponentType, LazyExoticComponent } from 'react'
import { motion } from 'framer-motion'
import { AppHeader } from '@/components/app/app-header'
import { AppSidebar } from '@/components/app/app-sidebar'
import { AppFooter } from '@/components/app/app-footer'
import { ViewSkeleton } from '@/components/app/view-skeleton'
import { useUiStore, VIEW_KEYS, type ViewKey } from '@/store/ui'

// Views are built by later tasks — placeholders exist so this compiles today.
const DashboardView = lazy(() => import('@/components/views/DashboardView'))
const PosView = lazy(() => import('@/components/views/PosView'))
const SalesView = lazy(() => import('@/components/views/SalesView'))
const ProductsView = lazy(() => import('@/components/views/ProductsView'))
const InventoryView = lazy(() => import('@/components/views/InventoryView'))
const ExpensesView = lazy(() => import('@/components/views/ExpensesView'))
const CustomersView = lazy(() => import('@/components/views/CustomersView'))
const SuppliersView = lazy(() => import('@/components/views/SuppliersView'))
const ReportsView = lazy(() => import('@/components/views/ReportsView'))
const SettingsView = lazy(() => import('@/components/views/SettingsView'))

const LAZY_VIEWS: Record<ViewKey, LazyExoticComponent<ComponentType>> = {
  dashboard: DashboardView,
  pos: PosView,
  sales: SalesView,
  products: ProductsView,
  inventory: InventoryView,
  expenses: ExpensesView,
  customers: CustomersView,
  suppliers: SuppliersView,
  reports: ReportsView,
  settings: SettingsView,
}

/** '#/pos' | '#pos' → 'pos' (null when the hash doesn't name a view). */
function viewFromHash(hash: string): ViewKey | null {
  const key = hash.replace(/^#\/?/, '').toLowerCase()
  return (VIEW_KEYS as readonly string[]).includes(key) ? (key as ViewKey) : null
}

export default function Shell() {
  const view = useUiStore((s) => s.view)
  const loadSettings = useUiStore((s) => s.loadSettings)
  const ActiveView = LAZY_VIEWS[view]

  // Hydrate the settings cache + currency symbol once per session.
  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  // URL hash → view (initial load, manual hash edits, back/forward).
  useEffect(() => {
    const applyHash = () => {
      const v = viewFromHash(window.location.hash)
      if (v && v !== useUiStore.getState().view) {
        useUiStore.getState().setView(v)
      }
    }
    applyHash()
    window.addEventListener('hashchange', applyHash)
    return () => window.removeEventListener('hashchange', applyHash)
  }, [])

  // View → URL hash + scroll restoration on every view change.
  useEffect(() => {
    const target = `#/${view}`
    if (window.location.hash !== target) {
      window.location.hash = target
    }
    window.scrollTo(0, 0)
  }, [view])

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      {/* Skip link for keyboard users */}
      <a
        href="#main"
        onClick={(e) => {
          e.preventDefault()
          document.getElementById('main')?.focus()
        }}
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <AppHeader />

      <div className="flex w-full flex-1">
        <AppSidebar />
        <main
          id="main"
          tabIndex={-1}
          className="min-w-0 flex-1 px-3 py-4 outline-none sm:px-5 sm:py-6"
        >
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <Suspense fallback={<ViewSkeleton />}>
              <ActiveView />
            </Suspense>
          </motion.div>
        </main>
      </div>

      <AppFooter />
    </div>
  )
}
