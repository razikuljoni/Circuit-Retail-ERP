'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { DatabaseZap, Loader2 } from 'lucide-react'
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
