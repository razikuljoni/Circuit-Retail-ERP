'use client'

// ── Stocktake — bulk physical inventory count with variance preview ──────────
// Search products, enter counted quantities, review the variance and apply
// everything in one transactional POST /api/stock/stocktake.
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  CheckCircle2,
  ClipboardCheck,
  History,
  Loader2,
  PackageSearch,
  Search,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { api } from '@/lib/api'
import { fmtDateTime, fmtMoney, fmtQty } from '@/lib/format'
import type { Product, StocktakeResult } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface CountRow {
  productId: string
  counted: string // raw input
}

// In-progress counts survive dialog close/reopen (and page reloads) via
// localStorage. Stale product ids are harmless — they never match a product.
const DRAFT_KEY = 'circuit.stocktake.draft.v1'

interface StocktakeDraft {
  rows: Record<string, string>
  note: string
  savedAt: string
}

function loadDraft(): StocktakeDraft | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const d = JSON.parse(raw) as StocktakeDraft
    if (!d || typeof d !== 'object' || typeof d.rows !== 'object') return null
    return d
  } catch {
    return null
  }
}

function saveDraft(rows: Record<string, string>, note: string) {
  try {
    const d: StocktakeDraft = { rows, note, savedAt: new Date().toISOString() }
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(d))
  } catch {
    /* storage full/blocked — persistence is best-effort */
  }
}

function clearDraft() {
  try {
    window.localStorage.removeItem(DRAFT_KEY)
  } catch {
    /* ignore */
  }
}

export function StocktakeDialog({
  open,
  onOpenChange,
  products,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  products: Product[]
  onDone: () => void
}) {
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<Record<string, string>>({})
  const [onlyChanged, setOnlyChanged] = useState(false)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<StocktakeResult | null>(null)
  const [resumed, setResumed] = useState<StocktakeDraft | null>(null)
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // On open: restore any in-progress draft; otherwise start fresh
  useEffect(() => {
    if (open) {
      const d = loadDraft()
      const valid = d && Object.keys(d.rows).length > 0 ? d : null
      setRows(valid?.rows ?? {})
      setNote(valid?.note ?? '')
      setResumed(valid)
      setDraftSavedAt(valid?.savedAt ?? null)
      setSearch('')
      setOnlyChanged(false)
      setResult(null)
      if (valid) {
        toast.info(`Resumed stocktake draft — ${Object.keys(valid.rows).length} count${Object.keys(valid.rows).length === 1 ? '' : 's'} saved ${fmtDateTime(valid.savedAt)}`)
      }
      requestAnimationFrame(() => searchRef.current?.focus())
    }
  }, [open])

  // Debounced auto-save while counting
  useEffect(() => {
    if (!open || result) return
    const has = Object.keys(rows).length > 0 || note.trim() !== ''
    const t = setTimeout(() => {
      if (has) {
        saveDraft(rows, note)
        setDraftSavedAt(new Date().toISOString())
      }
    }, 600)
    return () => clearTimeout(t)
  }, [rows, note, open, result])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const base = q
      ? products.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.sku.toLowerCase().includes(q) ||
            (p.barcode ? p.barcode.toLowerCase().includes(q) : false)
        )
      : products
    if (!onlyChanged) return base.slice(0, 200)
    return base.filter((p) => {
      const raw = rows[p.id]
      if (raw === undefined || raw.trim() === '') return false
      const n = Number(raw)
      return Number.isFinite(n) && n !== p.stock
    })
  }, [products, search, rows, onlyChanged])

  const changes = useMemo(() => {
    const list: { product: Product; counted: number; delta: number }[] = []
    for (const p of products) {
      const raw = rows[p.id]
      if (raw === undefined || String(raw).trim() === '') continue
      const n = Number(raw)
      if (!Number.isFinite(n) || n < 0) continue
      if (n !== p.stock) list.push({ product: p, counted: n, delta: n - p.stock })
    }
    return list.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
  }, [products, rows])

  const varianceValue = useMemo(
    () => changes.reduce((s, c) => s + c.delta * c.product.costPrice, 0),
    [changes]
  )

  function setCount(productId: string, value: string) {
    setRows((r) => ({ ...r, [productId]: value }))
  }

  async function submit() {
    if (changes.length === 0) {
      toast.error('No counted quantities differ from system stock')
      return
    }
    setSaving(true)
    try {
      const res = await api.post<StocktakeResult>('/api/stock/stocktake', {
        counts: changes.map((c) => ({ productId: c.product.id, countedQty: c.counted })),
        note: note.trim() || 'Physical count',
      })
      setResult(res)
      clearDraft()
      setResumed(null)
      setDraftSavedAt(null)
      toast.success(
        `Stocktake saved — ${res.adjusted} item${res.adjusted === 1 ? '' : 's'} corrected, ${res.unchanged} matched`
      )
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to record stocktake')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="size-4 text-primary" aria-hidden /> Stocktake — physical count
          </DialogTitle>
          <DialogDescription>
            Enter what you actually count on the shelf. Only rows that differ from system stock are applied —
            each correction is written to the movement ledger as an adjustment.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="size-4 shrink-0" aria-hidden />
              <span>
                <strong>{result.adjusted}</strong> corrected · <strong>{result.unchanged}</strong> matched ·
                variance {fmtMoney(result.varianceValue)} at cost
              </span>
            </div>
            <div className="max-h-[45vh] overflow-y-auto rounded-lg border">
              <table className="w-full text-sm">
                <tbody className="divide-y">
                  {result.items.map((i) => (
                    <tr key={i.productId} className="px-1">
                      <td className="px-3 py-2">
                        <p className="font-medium leading-tight">{i.name}</p>
                        <p className="font-mono text-[11px] text-muted-foreground">{i.sku}</p>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {fmtQty(i.before)}
                      </td>
                      <td className="px-3 py-2 text-center text-muted-foreground">→</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">{fmtQty(i.after)}</td>
                      <td
                        className={cn(
                          'px-3 py-2 text-right font-medium tabular-nums',
                          i.delta > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                        )}
                      >
                        {i.delta > 0 ? '+' : ''}
                        {fmtQty(i.delta)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            {/* Draft persistence indicator */}
            {(resumed || draftSavedAt) && Object.keys(rows).length > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                <History className="size-3.5 shrink-0 text-primary" aria-hidden />
                <span>
                  Draft auto-saved{draftSavedAt ? ` at ${fmtDateTime(draftSavedAt)}` : ''} ·{' '}
                  <strong className="text-foreground tabular-nums">{Object.keys(rows).length}</strong>{' '}
                  count{Object.keys(rows).length === 1 ? '' : 's'} kept if you close or reload
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    setRows({})
                    setNote('')
                    clearDraft()
                    setResumed(null)
                    setDraftSavedAt(null)
                  }}
                  disabled={saving}
                >
                  Discard draft
                </Button>
              </div>
            )}

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  ref={searchRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, SKU or barcode…"
                  className="h-9 pl-8"
                  aria-label="Search products to count"
                />
              </div>
              <Label className="flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-normal text-muted-foreground cursor-pointer">
                <Checkbox checked={onlyChanged} onCheckedChange={(v) => setOnlyChanged(v === true)} aria-label="Show only changed rows" />
                Changed only
              </Label>
            </div>

            {/* Count list */}
            <div className="max-h-[42vh] overflow-y-auto rounded-lg border" aria-label="Product count list">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <PackageSearch className="size-8 text-muted-foreground/50" aria-hidden />
                  <p className="text-sm text-muted-foreground">
                    {onlyChanged ? 'No counted rows differ from system stock yet.' : 'No products match your search.'}
                  </p>
                </div>
              ) : (
                <ul className="divide-y">
                  {filtered.map((p) => {
                    const raw = rows[p.id]
                    const n = raw !== undefined && raw.trim() !== '' ? Number(raw) : NaN
                    const differs = Number.isFinite(n) && n !== p.stock
                    const up = differs && n > p.stock
                    return (
                      <li key={p.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/40 transition-colors">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium leading-tight">{p.name}</p>
                          <p className="font-mono text-[11px] text-muted-foreground">
                            {p.sku}
                            {p.barcode ? ` · ${p.barcode}` : ''}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[11px] text-muted-foreground">System</p>
                          <p className="text-sm font-semibold tabular-nums">{fmtQty(p.stock)}</p>
                        </div>
                        <div className="shrink-0">
                          <Input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            step="1"
                            value={raw ?? ''}
                            onChange={(e) => setCount(p.id, e.target.value)}
                            placeholder={String(p.stock)}
                            aria-label={`Counted quantity for ${p.name} (system ${p.stock})`}
                            className={cn(
                              'h-9 w-[92px] text-right tabular-nums',
                              differs && (up ? 'border-emerald-500/60 focus-visible:ring-emerald-500/30' : 'border-red-500/60 focus-visible:ring-red-500/30')
                            )}
                          />
                        </div>
                        <div className="w-[74px] text-right shrink-0">
                          {differs ? (
                            <Badge
                              variant="outline"
                              className={cn(
                                'gap-0.5 tabular-nums',
                                up
                                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                                  : 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400'
                              )}
                            >
                              {up ? <TrendingUp className="size-3" aria-hidden /> : <TrendingDown className="size-3" aria-hidden />}
                              {up ? '+' : ''}
                              {fmtQty(n - p.stock)}
                            </Badge>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">match</span>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            {/* Summary + note */}
            <div className="space-y-3">
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note for the ledger (e.g. monthly count, who counted)…"
                aria-label="Stocktake note"
                className="h-9"
              />
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
                <span className="text-muted-foreground">
                  <strong className="text-foreground tabular-nums">{changes.length}</strong> row
                  {changes.length === 1 ? '' : 's'} will be corrected
                  {changes.length > 0 && (
                    <span className={cn('ml-2 font-medium tabular-nums', varianceValue < 0 ? 'text-red-600 dark:text-red-400' : varianceValue > 0 ? 'text-emerald-600 dark:text-emerald-400' : '')}>
                      ({varianceValue >= 0 ? '+' : ''}
                      {fmtMoney(varianceValue)} at cost)
                    </span>
                  )}
                </span>
                {changes.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      setRows({})
                      clearDraft()
                      setDraftSavedAt(null)
                    }}
                    disabled={saving}
                  >
                    Reset counts
                  </Button>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={saving || changes.length === 0}>
                {saving && <Loader2 className="size-4 animate-spin" aria-label="Applying" />}
                Apply {changes.length > 0 ? `${changes.length} correction${changes.length === 1 ? '' : 's'}` : 'stocktake'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
