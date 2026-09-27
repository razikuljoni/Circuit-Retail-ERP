// ── Global UI state (zustand) ────────────────────────────────────────────────
// Owns: active view (SPA shell), mobile sidebar drawer, cached store settings.
import { create } from 'zustand'
import { setCurrencySymbol } from '@/lib/format'
import type { StoreSettings } from '@/lib/types'

export type ViewKey =
  | 'dashboard'
  | 'pos'
  | 'sales'
  | 'products'
  | 'inventory'
  | 'expenses'
  | 'customers'
  | 'suppliers'
  | 'reports'
  | 'settings'

export const VIEW_KEYS: readonly ViewKey[] = [
  'dashboard',
  'pos',
  'sales',
  'products',
  'inventory',
  'expenses',
  'customers',
  'suppliers',
  'reports',
  'settings',
] as const

/** Defaults mirror the seeded DB settings, so first paint is already correct. */
export const DEFAULT_SETTINGS: StoreSettings = {
  id: 'default',
  storeName: 'Circuit Electronics & More',
  address: 'Dhaka, Bangladesh',
  phone: '',
  currency: '৳',
  currencyCode: 'BDT',
  taxRate: 0,
  receiptFooter: 'Thank you for shopping with us!',
}

/** Defensively normalize the /api/settings payload (handles {settings:{...}} wrappers). */
function normalizeSettings(raw: unknown): StoreSettings | null {
  if (!raw || typeof raw !== 'object') return null
  const outer = raw as Record<string, unknown>
  const s = (
    typeof outer.settings === 'object' && outer.settings !== null
      ? outer.settings
      : outer
  ) as Record<string, unknown>
  if (typeof s.storeName !== 'string' || !s.storeName) return null
  return {
    id: typeof s.id === 'string' ? s.id : DEFAULT_SETTINGS.id,
    storeName: s.storeName,
    address: typeof s.address === 'string' ? s.address : '',
    phone: typeof s.phone === 'string' ? s.phone : '',
    currency: typeof s.currency === 'string' && s.currency ? s.currency : DEFAULT_SETTINGS.currency,
    currencyCode: typeof s.currencyCode === 'string' ? s.currencyCode : DEFAULT_SETTINGS.currencyCode,
    taxRate: typeof s.taxRate === 'number' ? s.taxRate : DEFAULT_SETTINGS.taxRate,
    receiptFooter: typeof s.receiptFooter === 'string' ? s.receiptFooter : '',
  }
}

interface UiState {
  /** Active SPA view (synced to URL hash by the shell). */
  view: ViewKey
  setView: (view: ViewKey) => void

  /** Mobile navigation drawer (shadcn Sheet). */
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void

  /** Cached store profile; hydrated once from GET /api/settings. */
  settings: StoreSettings
  settingsLoaded: boolean
  setSettings: (settings: StoreSettings) => void
  loadSettings: () => Promise<void>
}

/** Module-level in-flight promise → loadSettings() only ever hits /api/settings once. */
let settingsInFlight: Promise<void> | null = null

export const useUiStore = create<UiState>((set, get) => ({
  view: 'dashboard',
  setView: (view) => set({ view }),

  sidebarOpen: false,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),

  settings: DEFAULT_SETTINGS,
  settingsLoaded: false,
  setSettings: (settings) => {
    setCurrencySymbol(settings.currency)
    set({ settings, settingsLoaded: true })
  },
  loadSettings: async () => {
    if (get().settingsLoaded) return
    if (settingsInFlight) return settingsInFlight
    settingsInFlight = (async () => {
      try {
        const res = await fetch('/api/settings', { cache: 'no-store' })
        if (!res.ok) throw new Error(`GET /api/settings → ${res.status}`)
        const data = normalizeSettings(await res.json())
        if (data) get().setSettings(data)
      } catch (err) {
        // API may not be ready yet — defaults stay in place, views still render.
        console.warn('[ui] loadSettings failed:', err)
      } finally {
        settingsInFlight = null
      }
    })()
    return settingsInFlight
  },
}))
