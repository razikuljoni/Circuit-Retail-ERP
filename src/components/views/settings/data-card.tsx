'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { DatabaseBackup, DatabaseZap, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'

interface SeedCounts {
  products?: number
  sales?: number
  saleItems?: number
  expenses?: number
  customers?: number
  movements?: number
}

function countsLine(counts: SeedCounts | undefined): string {
  if (!counts) return ''
  const parts: string[] = []
  for (const [key, label] of [
    ['products', 'products'],
    ['sales', 'sales'],
    ['expenses', 'expenses'],
  ] as const) {
    const v = counts[key]
    if (typeof v === 'number') parts.push(`${v} ${label}`)
  }
  return parts.length ? ` (${parts.join(', ')})` : ''
}

export function DataCard({ onReseeded }: { onReseeded: () => void }) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [backingUp, setBackingUp] = useState(false)

  async function downloadBackup() {
    setBackingUp(true)
    try {
      const res = await fetch('/api/backup', { cache: 'no-store' })
      if (!res.ok) throw new Error(`Backup failed (${res.status})`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')
      a.href = url
      a.download = `circuit-backup-${stamp}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Backup downloaded — keep it somewhere safe')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Backup failed')
    } finally {
      setBackingUp(false)
    }
  }

  async function reseed() {
    setPending(true)
    try {
      const res = await api.post<{ ok: boolean; counts?: SeedCounts }>('/api/seed')
      toast.success(`Demo data restored${countsLine(res.counts)}`)
      setConfirmOpen(false)
      onReseeded()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Reseed failed')
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Data</CardTitle>
        <CardDescription>Demo dataset management.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-4">
          <div className="flex items-start gap-3">
            <DatabaseBackup className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" aria-hidden />
            <div className="min-w-0">
              <p className="text-sm font-semibold">Backup</p>
              <p className="text-xs text-muted-foreground mt-1">
                Downloads a full JSON snapshot — every product, sale, expense, customer and stock movement, ready to re-import or archive.
              </p>
              <Button variant="outline" className="mt-3 border-emerald-500/50 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10" disabled={backingUp} onClick={downloadBackup}>
                {backingUp && <Loader2 className="size-4 mr-1.5 animate-spin" aria-hidden />}
                Download backup (JSON)
              </Button>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
          <div className="flex items-start gap-3">
            <DatabaseZap className="size-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" aria-hidden />
            <div className="min-w-0">
              <p className="text-sm font-semibold">Demo data</p>
              <p className="text-xs text-muted-foreground mt-1">
                Restores the full demo dataset — products, customers, sales, expenses and stock history.
                <span className="font-medium text-amber-700 dark:text-amber-400"> This replaces ALL current data.</span>
              </p>
              <Button variant="outline" className="mt-3 border-amber-500/50 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10" onClick={() => setConfirmOpen(true)}>
                Reseed demo data
              </Button>
            </div>
          </div>
        </div>
      </CardContent>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Reseed demo data?"
        message="Every product, sale, customer, expense and stock movement in the database will be REPLACED with the demo dataset. This cannot be undone."
        confirmLabel="Replace all data"
        pending={pending}
        onConfirm={reseed}
      />
    </Card>
  )
}
