'use client'

// ── Dashboard: chart cards (hourly area, payment donut, 14-day trend, top products) ──
import { useMemo } from 'react'
import type { ReactNode } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts'
import { CreditCard, PackageOpen, ShoppingBag } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { EmptyState } from '@/components/shared/page-bits'
import { fmtMoney, fmtQty } from '@/lib/format'
import type { DashboardData } from '@/lib/types'

// Theme vars are raw oklch values in globals.css → use `var(--chart-N)` directly.
const PIE_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']
const EMERALD = '#10b981'

const TREND_CONFIG = {
  sales: { label: 'Sales', color: 'var(--chart-1)' },
  expenses: { label: 'Expenses', color: 'var(--chart-5)' },
  profit: { label: 'Profit', color: EMERALD },
} satisfies ChartConfig

const TREND_LABELS: Record<string, string> = { sales: 'Sales', expenses: 'Expenses', profit: 'Profit' }

const compactTick = (v: unknown) => fmtMoney(Number(v), { compact: true, symbol: false })

/** Tooltip row renderer that formats every series value as money. */
function moneyFormatter(labels: Record<string, string>) {
  return (value: unknown, name: unknown, item: unknown): ReactNode => {
    const it = item as { color?: string; payload?: { fill?: string } } | null
    const dot = it?.color ?? it?.payload?.fill
    return (
      <div className="flex w-full items-center justify-between gap-4">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="size-2 rounded-[2px]" style={{ backgroundColor: dot }} aria-hidden />
          {labels[String(name)] ?? String(name)}
        </span>
        <span className="font-mono font-medium tabular-nums text-foreground">{fmtMoney(Number(value))}</span>
      </div>
    )
  }
}

function ChartSkeleton({ className = 'h-[260px]' }: { className?: string }) {
  return <Skeleton className={`${className} w-full rounded-xl`} aria-hidden />
}

interface ChartCardProps {
  loading: boolean
  title: string
  description?: string
}

function ChartCard({ loading, title, description, children }: ChartCardProps & { children: ReactNode }) {
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
      </CardHeader>
      <CardContent>{loading ? <ChartSkeleton /> : children}</CardContent>
    </Card>
  )
}

// ── Sales by hour (today) ────────────────────────────────────────────────────

export function HourlySalesCard({ data, loading }: { data: DashboardData | null; loading: boolean }) {
  const hourly = useMemo(
    () =>
      (data?.hourly ?? []).map((h) => ({
        label: h.label ?? `${Number(h.hour) % 12 === 0 ? 12 : Number(h.hour) % 12}${Number(h.hour) < 12 ? ' AM' : ' PM'}`,
        sales: h.sales,
      })),
    [data]
  )
  const hasSales = (data?.hourly ?? []).some((h) => h.transactions > 0 || h.sales > 0)

  return (
    <ChartCard
      loading={loading}
      title="Sales by hour (today)"
      description="Revenue distribution across Dhaka business hours"
      // span 2/3 on large screens, set by parent grid ordering
    >
      {hasSales ? (
        <ChartContainer config={{ sales: { label: 'Sales', color: 'var(--chart-1)' } }} className="h-[260px] w-full">
          <AreaChart data={hourly} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="fillHourlySales" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.7} />
                <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.08} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} tickMargin={8} />
            <YAxis tickFormatter={compactTick} tickLine={false} axisLine={false} width={52} />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="line" formatter={moneyFormatter({ sales: 'Sales' })} />}
            />
            <Area
              dataKey="sales"
              type="monotone"
              fill="url(#fillHourlySales)"
              stroke="var(--chart-1)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      ) : (
        <EmptyState
          icon={ShoppingBag}
          title="No sales yet today"
          message="Hourly revenue will appear here as soon as the first transaction lands."
          className="py-8"
        />
      )}
    </ChartCard>
  )
}

// ── Payment mix (today) ──────────────────────────────────────────────────────

const METHOD_LABEL: Record<string, string> = { CASH: 'Cash', CARD: 'Card', MOBILE: 'Mobile', BANK: 'Bank' }

export function PaymentMixCard({ data, loading }: { data: DashboardData | null; loading: boolean }) {
  const mix = useMemo(
    () =>
      (data?.paymentMix ?? [])
        .filter((m) => m.amount > 0 || m.count > 0)
        .map((m) => ({
          method: METHOD_LABEL[m.method] ?? m.method,
          amount: m.amount,
          count: m.count,
        })),
    [data]
  )
  const config = useMemo(
    () =>
      Object.fromEntries(
        mix.map((m, i) => [m.method, { label: m.method, color: PIE_COLORS[i % PIE_COLORS.length] }])
      ) satisfies ChartConfig,
    [mix]
  )
  const methodLabels = useMemo(() => Object.fromEntries(mix.map((m) => [m.method, m.method])), [mix])

  return (
    <ChartCard loading={loading} title="Payment mix (today)" description="How customers paid today">
      {mix.length > 0 ? (
        <div>
          <ChartContainer config={config} className="mx-auto h-[200px] w-full">
            <PieChart>
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel formatter={moneyFormatter(methodLabels)} />}
              />
              <Pie
                data={mix}
                dataKey="amount"
                nameKey="method"
                innerRadius={58}
                outerRadius={88}
                paddingAngle={3}
                strokeWidth={2}
              >
                {mix.map((entry, i) => (
                  <Cell key={entry.method} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
          <div className="mt-3 space-y-1.5">
            {mix.map((m, i) => (
              <div key={m.method} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-[2px]"
                    style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                    aria-hidden
                  />
                  <span className="truncate">{m.method}</span>
                  <span className="text-xs text-muted-foreground">× {m.count}</span>
                </span>
                <span className="font-medium tabular-nums">{fmtMoney(m.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <EmptyState
          icon={CreditCard}
          title="No payments today"
          message="The donut fills up with today's cash, card and mobile splits."
          className="py-8"
        />
      )}
    </ChartCard>
  )
}

// ── Last 14 days: sales vs expenses vs profit ────────────────────────────────

export function DailyTrendCard({ data, loading }: { data: DashboardData | null; loading: boolean }) {
  const daily = data?.daily ?? []
  return (
    <ChartCard
      loading={loading}
      title="Last 14 days — sales vs expenses vs profit"
      description="Daily revenue and expenses with net profit overlay"
    >
      <ChartContainer config={TREND_CONFIG} className="h-[280px] w-full">
        <ComposedChart data={daily} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={18} tickMargin={8} />
          <YAxis tickFormatter={compactTick} tickLine={false} axisLine={false} width={52} />
          <ChartTooltip
            cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
            content={<ChartTooltipContent formatter={moneyFormatter(TREND_LABELS)} />}
          />
          <Bar dataKey="sales" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={26} />
          <Bar dataKey="expenses" fill="var(--chart-5)" radius={[4, 4, 0, 0]} maxBarSize={26} />
          <Line dataKey="profit" type="monotone" stroke={EMERALD} strokeWidth={2} dot={false} />
        </ComposedChart>
      </ChartContainer>
    </ChartCard>
  )
}

// ── Top products (7 days) ────────────────────────────────────────────────────

interface TopProductDatum {
  name: string
  shortName: string
  qty: number
  revenue: number
}

function TopProductsTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload?: TopProductDatum }>
}) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div className="border-border/50 bg-background grid min-w-[9rem] gap-1 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl">
      <p className="font-medium">{d.name}</p>
      <div className="flex items-center justify-between gap-4 text-muted-foreground">
        <span>Qty sold</span>
        <span className="font-mono font-medium tabular-nums text-foreground">{fmtQty(d.qty)}</span>
      </div>
      <div className="flex items-center justify-between gap-4 text-muted-foreground">
        <span>Revenue</span>
        <span className="font-mono font-medium tabular-nums text-foreground">{fmtMoney(d.revenue)}</span>
      </div>
    </div>
  )
}

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

export function TopProductsCard({ data, loading }: { data: DashboardData | null; loading: boolean }) {
  const products: TopProductDatum[] = useMemo(
    () =>
      (data?.topProducts ?? []).map((p) => ({
        name: p.name,
        shortName: truncate(p.name, 15),
        qty: p.qty,
        revenue: p.revenue,
      })),
    [data]
  )

  return (
    <ChartCard
      loading={loading}
      title="Top products (7 days)"
      description="Best sellers by units moved this week"
    >
      {products.length > 0 ? (
        <ChartContainer config={{ qty: { label: 'Qty sold', color: 'var(--chart-2)' } }} className="h-[230px] w-full">
          <BarChart data={products} layout="vertical" margin={{ left: 4, right: 32, top: 4, bottom: 4 }}>
            <CartesianGrid horizontal={false} />
            <XAxis type="number" hide domain={[0, 'dataMax']} />
            <YAxis
              type="category"
              dataKey="shortName"
              width={118}
              tickLine={false}
              axisLine={false}
              tickMargin={4}
              fontSize={11}
            />
            <ChartTooltip cursor={false} content={<TopProductsTooltip />} />
            <Bar dataKey="qty" fill="var(--chart-2)" radius={[0, 4, 4, 0]} barSize={16}>
              <LabelList
                dataKey="qty"
                position="right"
                className="fill-foreground text-[11px]"
                formatter={(v: unknown) => fmtQty(Number(v))}
              />
            </Bar>
          </BarChart>
        </ChartContainer>
      ) : (
        <EmptyState
          icon={PackageOpen}
          title="No product sales this week"
          message="Top sellers appear here once items are rung up in POS."
          className="py-8"
        />
      )}
    </ChartCard>
  )
}
