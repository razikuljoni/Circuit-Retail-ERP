'use client'

// ── Reports: controls card (tab switcher + date range + quick ranges) ────────
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { QUICK_RANGES, matchQuickRange, type ReportType } from './reports-utils'

interface ControlsCardProps {
  tab: ReportType
  onTabChange: (tab: ReportType) => void
  from: string
  to: string
  onRangeChange: (range: { from: string; to: string }) => void
}

export function ControlsCard({ tab, onTabChange, from, to, onRangeChange }: ControlsCardProps) {
  const activeQuick = matchQuickRange(from, to)

  return (
    <Card className="py-4">
      <CardContent className="flex flex-col gap-3 px-4 lg:flex-row lg:items-center lg:justify-between">
        <Tabs
          value={tab}
          onValueChange={(v) => onTabChange(v as ReportType)}
          aria-label="Report type"
        >
          <TabsList>
            <TabsTrigger value="pnl">P&amp;L</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="daily">Daily</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            From
            <Input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => onRangeChange({ from: e.target.value, to })}
              className="h-9 w-[140px] tabular-nums"
              aria-label="Range start date"
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            To
            <Input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => onRangeChange({ from, to: e.target.value })}
              className="h-9 w-[140px] tabular-nums"
              aria-label="Range end date"
            />
          </label>

          <div className="ml-1 flex flex-wrap items-center gap-1.5 border-l pl-3" role="group" aria-label="Quick date ranges">
            {QUICK_RANGES.map((q) => (
              <Button
                key={q.key}
                type="button"
                size="sm"
                variant={activeQuick === q.key ? 'secondary' : 'ghost'}
                className={`h-8 px-2.5 text-xs ${activeQuick === q.key ? 'font-semibold' : 'text-muted-foreground'}`}
                onClick={() => onRangeChange(q.range())}
                aria-pressed={activeQuick === q.key}
              >
                {q.label}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
