'use client'

import { Boxes, Cpu, Database, Settings } from 'lucide-react'
import { useApi } from '@/hooks/use-api'
import type { StoreSettings } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { PageHeader, ErrorState, ViewLoader } from '@/components/shared/page-bits'
import { ProfileForm } from './settings/profile-form'
import { DataCard } from './settings/data-card'

const STACK = ['Next.js 16', 'TypeScript', 'SQLite', 'Prisma', 'shadcn/ui', 'Tailwind CSS 4'] as const

export default function SettingsView() {
  const { data, loading, error, refetch } = useApi<StoreSettings>('/api/settings')

  if (loading && !data) return <ViewLoader />

  return (
    <div>
      <PageHeader icon={Settings} title="Settings" subtitle="Store profile, currency and receipt" />

      {error && !data ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2 items-start">
          {/* Keyed remount keeps the form in sync with freshly loaded settings */}
          {data && <ProfileForm key={`${data.id}-${data.storeName}-${data.taxRate}`} initial={data} />}

          <div className="space-y-6">
            <DataCard onReseeded={refetch} />
            <AboutCard />
          </div>
        </div>
      )}
    </div>
  )
}

function AboutCard() {
  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5">
            <Cpu className="size-5 text-primary" aria-hidden />
          </div>
          <div>
            <p className="font-semibold">Circuit Retail ERP</p>
            <p className="text-xs text-muted-foreground">Version 1.0 · single-tenant retail suite</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {STACK.map((s) => (
            <Badge key={s} variant="secondary" className="gap-1">
              {s === 'SQLite' || s === 'Prisma' ? <Database className="size-2.5" aria-hidden /> : null}
              {s === 'Next.js 16' ? <Boxes className="size-2.5" aria-hidden /> : null}
              {s}
            </Badge>
          ))}
        </div>

        <p className="text-xs text-muted-foreground border-t pt-3">
          All records are kept in <span className="font-medium text-foreground">Asia/Dhaka (UTC+6)</span> — daily reports,
          month scopes and invoice numbering follow the Dhaka calendar.
        </p>
      </div>
    </div>
  )
}
