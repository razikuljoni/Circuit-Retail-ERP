'use client'

// ── Global command palette (Ctrl/⌘ + K) ─────────────────────────────────────
// Quick-jump navigation + common actions. Mounted once in the shell;
// other components can open it via `openCommandPalette()`.
import { useCallback, useEffect, useState } from 'react'
import {
  Banknote,
  PackagePlus,
  Plus,
  ReceiptText,
  ScanBarcode,
  Wallet,
  Warehouse,
} from 'lucide-react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { useUiStore, type ViewKey } from '@/store/ui'
import { NAV_SECTIONS } from '@/components/app/nav-list'

const PALETTE_EVENT = 'app:command-palette'

/** Open the command palette from anywhere (same as pressing Ctrl/⌘+K). */
export function openCommandPalette() {
  window.dispatchEvent(new CustomEvent(PALETTE_EVENT))
}

const QUICK_ACTIONS: {
  label: string
  hint: string
  icon: typeof Plus
  view: ViewKey
}[] = [
  { label: 'Start new sale', hint: 'POS terminal', icon: ScanBarcode, view: 'pos' },
  { label: 'Record an expense', hint: 'Expenses', icon: Wallet, view: 'expenses' },
  { label: 'Add a product', hint: 'Products', icon: PackagePlus, view: 'products' },
  { label: 'Receive / adjust stock', hint: 'Inventory', icon: Warehouse, view: 'inventory' },
]

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const setView = useUiStore((s) => s.setView)

  const toggle = useCallback(() => setOpen((o) => !o), [])

  // Global shortcut: Ctrl/Cmd + K, plus custom event from trigger buttons
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        toggle()
      }
    }
    const onEvent = () => toggle()
    window.addEventListener('keydown', onKey)
    window.addEventListener(PALETTE_EVENT, onEvent)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener(PALETTE_EVENT, onEvent)
    }
  }, [toggle])

  const go = (view: ViewKey) => {
    setOpen(false)
    setView(view)
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search pages and actions…" aria-label="Command palette search" />
      <CommandList className="max-h-[380px]">
        <CommandEmpty>No matching commands.</CommandEmpty>

        <CommandGroup heading="Quick actions">
          {QUICK_ACTIONS.map((a) => {
            const Icon = a.icon
            return (
              <CommandItem key={a.label} value={`${a.label} ${a.hint}`} onSelect={() => go(a.view)}>
                <Icon className="size-4 text-primary" />
                <span>{a.label}</span>
                <span className="ml-auto text-xs text-muted-foreground">{a.hint}</span>
              </CommandItem>
            )
          })}
        </CommandGroup>

        <CommandSeparator />

        {NAV_SECTIONS.map((section) => (
          <CommandGroup key={section.label} heading={section.label}>
            {section.items.map((item) => {
              const Icon = item.icon
              return (
                <CommandItem key={item.key} value={`go to ${item.label}`} onSelect={() => go(item.key)}>
                  <Icon className="size-4 text-muted-foreground" />
                  <span>Go to {item.label}</span>
                </CommandItem>
              )
            })}
          </CommandGroup>
        ))}

        <CommandSeparator />

        <CommandGroup heading="Tips">
          <CommandItem value="tip cash drawer" onSelect={() => go('dashboard')}>
            <Banknote className="size-4 text-muted-foreground" />
            <span>Cash drawer summary lives on the Dashboard</span>
          </CommandItem>
          <CommandItem value="tip pos shortcuts" onSelect={() => go('pos')}>
            <ReceiptText className="size-4 text-muted-foreground" />
            <span>In POS: F2 = search · F9 = checkout</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
