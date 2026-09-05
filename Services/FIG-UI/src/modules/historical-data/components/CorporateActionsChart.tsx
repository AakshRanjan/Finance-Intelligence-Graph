import { useMemo, type ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from 'recharts'

import type {
  CorporateAction,
  CorporateActionKind,
  Dividend,
  Earning,
  EarningsMetric,
  Split,
} from '@/modules/historical-data/api/types'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  type ChartConfig,
} from '@/components/ui/chart'

const TEAL = '#26a69a'
const INDIGO = '#5c6bc0'
const SLATE = '#90a4ae'

const numberFormat = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 4,
})
const revenueFormat = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
})
const factorFormat = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 4,
})

const dividendConfig = {
  dividend: { label: 'Dividend', color: TEAL },
  adjDividend: { label: 'Adj dividend', color: INDIGO },
} satisfies ChartConfig

const earningsConfig = {
  actual: { label: 'Actual', color: TEAL },
  estimated: { label: 'Estimated', color: SLATE },
} satisfies ChartConfig

const splitConfig = {
  factor: { label: 'Share factor', color: TEAL },
} satisfies ChartConfig

interface CorporateActionsChartProps {
  kind: CorporateActionKind
  rows: CorporateAction[]
  symbol: string
  from: string
  to: string
  earningsMetric: EarningsMetric
}

interface DividendPoint {
  label: string
  tooltipLabel: string
  dividend: number
  adjDividend: number
  yield: number
  frequency: string
}

interface EarningsPoint {
  label: string
  tooltipLabel: string
  actual: number | null
  estimated: number | null
}

interface SplitPoint {
  x: number
  label: string
  tooltipLabel: string
  factor: number
  isEvent: boolean
  ratio?: string
  splitType?: string
}

function formatDate(value: string): string {
  return value.slice(0, 10)
}

function toUtcMs(value: string): number {
  return Date.parse(`${formatDate(value)}T00:00:00Z`)
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '—'
  }
  return numberFormat.format(value)
}

function formatRevenue(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '—'
  }
  return revenueFormat.format(value)
}

function toDividendPoints(rows: CorporateAction[]): DividendPoint[] {
  return [...rows]
    .map((row) => row as Dividend)
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((row) => ({
      label: formatDate(row.date),
      tooltipLabel: formatDate(row.date),
      dividend: row.dividend,
      adjDividend: row.adjDividend,
      yield: row.yield,
      frequency: row.frequency,
    }))
}

function toEarningsPoints(
  rows: CorporateAction[],
  metric: EarningsMetric,
): EarningsPoint[] {
  return [...rows]
    .map((row) => row as Earning)
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((row) => ({
      label: formatDate(row.date),
      tooltipLabel: formatDate(row.date),
      actual:
        metric === 'eps' ? (row.epsActual ?? null) : (row.revenueActual ?? null),
      estimated:
        metric === 'eps'
          ? (row.epsEstimated ?? null)
          : (row.revenueEstimated ?? null),
    }))
}

function toSplitPoints(
  rows: CorporateAction[],
  from: string,
  to: string,
): SplitPoint[] {
  const splits = [...rows]
    .map((row) => row as Split)
    .sort((left, right) => left.date.localeCompare(right.date))
  const fromMs = toUtcMs(from)
  const toMs = toUtcMs(to)
  const points: SplitPoint[] = [
    {
      x: fromMs,
      label: formatDate(from),
      tooltipLabel: formatDate(from),
      factor: 1,
      isEvent: false,
    },
  ]
  let factor = 1
  for (const split of splits) {
    if (split.denominator === 0) {
      continue
    }
    factor *= split.numerator / split.denominator
    points.push({
      x: toUtcMs(split.date),
      label: formatDate(split.date),
      tooltipLabel: formatDate(split.date),
      factor,
      isEvent: true,
      ratio: `${split.numerator}/${split.denominator}`,
      splitType: split.splitType,
    })
  }
  const last = points[points.length - 1]
  if (last !== undefined && last.x < toMs) {
    points.push({
      x: toMs,
      label: formatDate(to),
      tooltipLabel: formatDate(to),
      factor: last.factor,
      isEvent: false,
    })
  }
  return points
}

function DividendTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: ReadonlyArray<{ payload: DividendPoint }>
}): ReactNode {
  if (active !== true || payload === undefined || payload.length === 0) {
    return null
  }
  const point = payload[0].payload
  return (
    <div className="grid min-w-40 gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs shadow-md">
      <p className="font-medium text-foreground">{point.tooltipLabel}</p>
      <p>Dividend {formatNumber(point.dividend)}</p>
      <p>Adj dividend {formatNumber(point.adjDividend)}</p>
      <p>Yield {formatNumber(point.yield)}%</p>
      <p>Frequency {point.frequency || '—'}</p>
    </div>
  )
}

function EarningsTooltip({
  active,
  payload,
  metric,
}: {
  active?: boolean
  payload?: ReadonlyArray<{ payload: EarningsPoint }>
  metric: EarningsMetric
}): ReactNode {
  if (active !== true || payload === undefined || payload.length === 0) {
    return null
  }
  const point = payload[0].payload
  const format = metric === 'revenue' ? formatRevenue : formatNumber
  const beat =
    point.actual !== null &&
    point.estimated !== null &&
    point.actual >= point.estimated
  return (
    <div className="grid min-w-40 gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs shadow-md">
      <p className="font-medium text-foreground">{point.tooltipLabel}</p>
      <p>Actual {format(point.actual)}</p>
      <p>Estimated {format(point.estimated)}</p>
      {point.actual !== null && point.estimated !== null ? (
        <p>{beat ? 'Beat' : 'Miss'}</p>
      ) : null}
    </div>
  )
}

function SplitTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: ReadonlyArray<{ payload: SplitPoint }>
}): ReactNode {
  if (active !== true || payload === undefined || payload.length === 0) {
    return null
  }
  const point = payload[0].payload
  return (
    <div className="grid min-w-40 gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs shadow-md">
      <p className="font-medium text-foreground">{point.tooltipLabel}</p>
      {point.isEvent ? (
        <>
          <p>Ratio {point.ratio ?? '—'}</p>
          <p>Type {point.splitType || '—'}</p>
        </>
      ) : null}
      <p>1 share became {factorFormat.format(point.factor)}</p>
    </div>
  )
}

function SplitEventDot(props: {
  cx?: number
  cy?: number
  payload?: SplitPoint
}) {
  if (
    props.payload?.isEvent !== true ||
    props.cx === undefined ||
    props.cy === undefined
  ) {
    return null
  }
  return (
    <circle
      cx={props.cx}
      cy={props.cy}
      r={4}
      fill="var(--color-factor)"
      stroke="var(--background)"
      strokeWidth={1}
    />
  )
}

function DividendsChart({
  points,
  symbol,
}: {
  points: DividendPoint[]
  symbol: string
}) {
  const first = points[0]
  const last = points[points.length - 1]
  if (first === undefined || last === undefined) {
    return (
      <div className="flex h-full min-h-[280px] items-center justify-center text-muted-foreground">
        No dividends to chart
      </div>
    )
  }
  const summary = `${symbol} dividends: ${points.length.toLocaleString()} payments from ${first.tooltipLabel} to ${last.tooltipLabel}.`

  return (
    <div className="relative flex h-full min-h-[280px] w-full flex-1 flex-col">
      <p className="sr-only">{summary}</p>
      <ChartContainer
        config={dividendConfig}
        className="aspect-auto h-full min-h-[280px] w-full"
      >
        <BarChart
          accessibilityLayer
          data={points}
          margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
        >
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            minTickGap={24}
            tickMargin={8}
          />
          <YAxis
            orientation="right"
            tickLine={false}
            axisLine={false}
            width={64}
            tickFormatter={(value: number) => numberFormat.format(value)}
          />
          <ChartTooltip content={<DividendTooltip />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar
            dataKey="dividend"
            fill="var(--color-dividend)"
            radius={2}
            isAnimationActive={false}
            maxBarSize={32}
          />
          <Bar
            dataKey="adjDividend"
            fill="var(--color-adjDividend)"
            radius={2}
            isAnimationActive={false}
            maxBarSize={32}
          />
        </BarChart>
      </ChartContainer>
    </div>
  )
}

function EarningsChart({
  points,
  symbol,
  metric,
}: {
  points: EarningsPoint[]
  symbol: string
  metric: EarningsMetric
}) {
  const first = points[0]
  const last = points[points.length - 1]
  if (first === undefined || last === undefined) {
    return (
      <div className="flex h-full min-h-[280px] items-center justify-center text-muted-foreground">
        No earnings to chart
      </div>
    )
  }
  const metricLabel = metric === 'eps' ? 'EPS' : 'revenue'
  const summary = `${symbol} ${metricLabel}: ${points.length.toLocaleString()} reports from ${first.tooltipLabel} to ${last.tooltipLabel}.`

  return (
    <div className="relative flex h-full min-h-[280px] w-full flex-1 flex-col">
      <p className="sr-only">{summary}</p>
      <ChartContainer
        config={earningsConfig}
        className="aspect-auto h-full min-h-[280px] w-full"
      >
        <BarChart
          accessibilityLayer
          data={points}
          margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
        >
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            minTickGap={24}
            tickMargin={8}
          />
          <YAxis
            orientation="right"
            tickLine={false}
            axisLine={false}
            width={72}
            tickFormatter={(value: number) =>
              metric === 'revenue'
                ? revenueFormat.format(value)
                : numberFormat.format(value)
            }
          />
          <ChartTooltip content={<EarningsTooltip metric={metric} />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar
            dataKey="actual"
            fill="var(--color-actual)"
            radius={2}
            isAnimationActive={false}
            maxBarSize={32}
          />
          <Bar
            dataKey="estimated"
            fill="var(--color-estimated)"
            radius={2}
            isAnimationActive={false}
            maxBarSize={32}
          />
        </BarChart>
      </ChartContainer>
    </div>
  )
}

function SplitsChart({
  points,
  symbol,
  fromMs,
  toMs,
}: {
  points: SplitPoint[]
  symbol: string
  fromMs: number
  toMs: number
}) {
  const events = points.filter((point) => point.isEvent)
  if (events.length === 0) {
    return (
      <div className="flex h-full min-h-[280px] items-center justify-center text-muted-foreground">
        No splits to chart
      </div>
    )
  }
  const lastEvent = events[events.length - 1]
  const lastFactor = lastEvent?.factor ?? 1
  const maxFactor = points.reduce(
    (max, point) => Math.max(max, point.factor),
    1,
  )
  const summary = `${symbol} splits: ${events.length.toLocaleString()} events. 1 share became ${factorFormat.format(lastFactor)}.`

  return (
    <div className="relative flex h-full min-h-[280px] w-full flex-1 flex-col">
      <p className="sr-only">{summary}</p>
      <ChartContainer
        config={splitConfig}
        className="aspect-auto h-full min-h-[280px] w-full"
      >
        <LineChart
          accessibilityLayer
          data={points}
          margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
        >
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            type="number"
            dataKey="x"
            domain={[fromMs, toMs]}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
            tickMargin={8}
            tickFormatter={(value: number) =>
              new Date(value).toISOString().slice(0, 10)
            }
          />
          <YAxis
            orientation="right"
            tickLine={false}
            axisLine={false}
            width={64}
            domain={[0, maxFactor === 0 ? 1 : maxFactor * 1.1]}
            tickFormatter={(value: number) => factorFormat.format(value)}
          />
          <ChartTooltip content={<SplitTooltip />} />
          <Line
            type="stepAfter"
            dataKey="factor"
            stroke="var(--color-factor)"
            strokeWidth={2}
            dot={SplitEventDot}
            isAnimationActive={false}
          />
        </LineChart>
      </ChartContainer>
    </div>
  )
}

export function CorporateActionsChart({
  kind,
  rows,
  symbol,
  from,
  to,
  earningsMetric,
}: CorporateActionsChartProps) {
  const dividendPoints = useMemo(
    () => (kind === 'dividends' ? toDividendPoints(rows) : []),
    [kind, rows],
  )
  const earningsPoints = useMemo(
    () =>
      kind === 'earnings' ? toEarningsPoints(rows, earningsMetric) : [],
    [kind, rows, earningsMetric],
  )
  const splitPoints = useMemo(
    () => (kind === 'splits' ? toSplitPoints(rows, from, to) : []),
    [kind, rows, from, to],
  )

  if (kind === 'dividends') {
    return <DividendsChart points={dividendPoints} symbol={symbol} />
  }
  if (kind === 'earnings') {
    return (
      <EarningsChart
        points={earningsPoints}
        symbol={symbol}
        metric={earningsMetric}
      />
    )
  }
  return (
    <SplitsChart
      points={splitPoints}
      symbol={symbol}
      fromMs={toUtcMs(from)}
      toMs={toUtcMs(to)}
    />
  )
}
