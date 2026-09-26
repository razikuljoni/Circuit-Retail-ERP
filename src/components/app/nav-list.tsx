'use client'

// ── Primary navigation list (shared by desktop aside + mobile Sheet) ─────────
import type { ComponentType } from 'react'
import {
  BarChart3,
  LayoutDashboard,
  Package,
  ReceiptText,
  ScanBarcode,
  Settings as SettingsIcon,
  Truck,
  Users,
  Wallet,
  Warehouse,
  type LucideIcon,
} from 'lucide-react'
import { useUiStore, type ViewKey } from '@/store/ui'
import { cn } from '@/lib/utils'

export interface NavItem {
  key: ViewKey
  label: string
  icon: LucideIcon
  /** Optional small badge (e.g. alert counts) rendered after the label. */
  badge?: string | number
}

export interface NavSection {
  label: string
  items: NavItem[]
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Main',
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { key: 'pos', label: 'POS Terminal', icon: ScanBarcode },
      { key: 'sales', label: 'Sales', icon: ReceiptText },
      { key: 'products', label: 'Products', icon: Package },
      { key: 'inventory', label: 'Inventory', icon: Warehouse },
    ],
  },
  {
    label: 'Manage',
    items: [
      { key: 'expenses', label: 'Expenses', icon: Wallet },
      { key: 'customers', label: 'Customers', icon: Users },
      { key: 'suppliers', label: 'Suppliers', icon: Truck },
    ],
  },
  {
    label: 'Insights',
    items: [
      { key: 'reports', label: 'Reports', icon: BarChart3 },
      { key: 'settings', label: 'Settings', icon: SettingsIcon },
    ],
  },
]

interface NavListProps {
  className?: string
  /** Called after a nav item activates — the mobile drawer closes itself. */
  onNavigate?: () => void
}

export function NavList({ className, onNavigate }: NavListProps) {
  const view = useUiStore((s) => s.view)
  const setView = useUiStore((s) => s.setView)

  return (
    <nav aria-label="Primary navigation" className={cn('min-h-0', className)}>
      {NAV_SECTIONS.map((section) => (
        <div key={section.label} role="presentation">
          <p className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {section.label}
          </p>
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active = item.key === view
              const Icon = item.icon as ComponentType<{ className?: string }>
              return (
                <li key={item.key}>
                  <button
                    type="button"
                    onClick={() => {
                      setView(item.key)
                      onNavigate?.()
                    }}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'relative flex min-h-10 w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium outline-none transition-colors',
                      'focus-visible:ring-2 focus-visible:ring-ring/50',
                      active
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    {active && (
                      <span
                        aria-hidden="true"
                        className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary-foreground/70"
                      />
                    )}
                    <Icon className="size-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                    {item.badge !== undefined && (
                      <span
                        className={cn(
                          'ml-auto inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none',
                          active
                            ? 'bg-primary-foreground/20 text-primary-foreground'
                            : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}
