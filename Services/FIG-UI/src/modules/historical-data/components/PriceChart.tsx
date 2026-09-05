import type { Bar, EodBar, Mode } from '@/modules/historical-data/api/types'
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from '@/components/ui/chart'
import { useMemo, type ReactNode } from 'react'
import {
  Bar as RechartsBar,
  CartesianGrid,
  ComposedChart,
  Rectangle,
  XAxis,
  YAxis,
  type BarShapeProps,
} from 'recharts'

const UP = '#26a69a'
const DOWN = '#ef5350'
const WICK = 'var(--foreground)'
const MAX_CHART_POINTS = 400
const VOLUME_BAND = 0.22
const PRICE_BAND = 1 - VOLUME_BAND

const chartConfig = {
  up: { label: 'Up', color: UP },
  down: { label: 'Down', color: DOWN },
  volume: { label: 'Volume', color: UP },
} satisfies ChartConfig

interface ChartPoint {
  label: string
  tooltipLabel: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  up: boolean
  changePercent?: number | null
}

interface PriceChartProps {
  bars: Bar[]
  mode: Mode
  symbol: string
}

const numberFormat = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 4,
})
const volumeFormat = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
})

function formatTick(date: string, mode: Mode): string {
  if (mode === 'eod') {
    return date.slice(0, 10)
  }
  return date.replace('T', ' ').replace('+00:00', '').slice(0, 16)
}

function formatFull(date: string): string {
  return date.replace('T', ' ').replace('+00:00', ' UTC')
}

function toPoint(bar: Bar, mode: Mode): ChartPoint {
  const eod = mode === 'eod' ? (bar as EodBar) : null
  return {
    label: formatTick(bar.date, mode),
    tooltipLabel: formatFull(bar.date),
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume,
    up: bar.close >= bar.open,
    changePercent: eod?.changePercent,
  }
}

function downsampleBars(bars: Bar[], mode: Mode): ChartPoint[] {
  if (bars.length <= MAX_CHART_POINTS) {
    return bars.map((bar) => toPoint(bar, mode))
  }
  const bucketSize = bars.length / MAX_CHART_POINTS
  const points: ChartPoint[] = []
  for (let index = 0; index < MAX_CHART_POINTS; index += 1) {
    const start = Math.floor(index * bucketSize)
    const end = Math.min(bars.length, Math.floor((index + 1) * bucketSize))
    if (start >= end) {
      continue
    }
    const slice = bars.slice(start, end)
    const first = slice[0]
    const last = slice[slice.length - 1]
    let high = first.high
    let low = first.low
    let volume = 0
    for (const bar of slice) {
      if (bar.high > high) {
        high = bar.high
      }
      if (bar.low < low) {
        low = bar.low
      }
      volume += bar.volume
    }
    const bucketed = slice.length > 1
    points.push({
      label: formatTick(first.date, mode),
      tooltipLabel: bucketed
        ? `${formatFull(first.date)} – ${formatFull(last.date)}`
        : formatFull(first.date),
      open: first.open,
      high,
      low,
      close: last.close,
      volume,
      up: last.close >= first.open,
    })
  }
  return points
}

function wickRange(point: ChartPoint): [number, number] {
  return [point.low, point.high]
}

function CandleShape(props: BarShapeProps) {
  const point = props.payload as ChartPoint | undefined
  const { x, y, width, height } = props
  if (
    point === undefined ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0
  ) {
    return null
  }

  const fill = point.up === false ? DOWN : UP
  const wickX = x + width / 2
  const span = point.high - point.low
  const wickTop = y
  const wickBottom = y + Math.max(height, 0)

  if (span <= 0 || height <= 0) {
    return (
      <g>
        <line
          x1={wickX}
          y1={wickTop}
          x2={wickX}
          y2={wickBottom}
          stroke={WICK}
          strokeWidth={1}
        />
        <rect x={x} y={y - 0.5} width={width} height={1} fill={fill} />
      </g>
    )
  }

  const scale = height / span
  const bodyTop = Math.max(point.open, point.close)
  const bodyBottom = Math.min(point.open, point.close)
  const bodyY = y + (point.high - bodyTop) * scale
  const bodyHeight = Math.max((bodyTop - bodyBottom) * scale, 1)

  return (
    <g>
      <line
        x1={wickX}
        y1={wickTop}
        x2={wickX}
        y2={wickBottom}
        stroke={WICK}
        strokeWidth={1}
      />
      <rect x={x} y={bodyY} width={width} height={bodyHeight} fill={fill} />
    </g>
  )
}

function VolumeBody(props: BarShapeProps) {
  const point = props.payload as ChartPoint | undefined
  const fill = point?.up === false ? 'rgba(239, 83, 80, 0.5)' : 'rgba(38, 166, 154, 0.5)'
  return <Rectangle {...props} fill={fill} stroke="none" />
}

function OhlcvTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: ReadonlyArray<{ payload: ChartPoint }>
}): ReactNode {
  if (active !== true || payload === undefined || payload.length === 0) {
    return null
  }
  const point = payload[0].payload
  return (
    <div className="grid min-w-40 gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs shadow-md">
      <p className="font-medium text-foreground">{point.tooltipLabel}</p>
      <p>Open {numberFormat.format(point.open)}</p>
      <p>High {numberFormat.format(point.high)}</p>
      <p>Low {numberFormat.format(point.low)}</p>
      <p>Close {numberFormat.format(point.close)}</p>
      <p>Volume {volumeFormat.format(point.volume)}</p>
      {point.changePercent !== null && point.changePercent !== undefined ? (
        <p>Change {numberFormat.format(point.changePercent)}%</p>
      ) : null}
    </div>
  )
}

export function PriceChart({ bars, mode, symbol }: PriceChartProps) {
  const points = useMemo(() => downsampleBars(bars, mode), [bars, mode])
  const last = points[points.length - 1]
  const first = points[0]
  const maxVolume = useMemo(
    () => points.reduce((max, point) => Math.max(max, point.volume), 0),
    [points],
  )
  const priceDomain = useMemo((): [number, number] | undefined => {
    if (points.length === 0) {
      return undefined
    }
    let minLow = points[0].low
    let maxHigh = points[0].high
    for (const point of points) {
      if (point.low < minLow) {
        minLow = point.low
      }
      if (point.high > maxHigh) {
        maxHigh = point.high
      }
    }
    const span = maxHigh - minLow
    const pad =
      span === 0 ? Math.max(Math.abs(maxHigh) * 0.01, 0.01) : span * 0.05
    const visualMin = minLow - pad
    const visualMax = maxHigh + pad
    const domainMin = (visualMin - VOLUME_BAND * visualMax) / PRICE_BAND
    return [domainMin, visualMax]
  }, [points])
  const downsampled = bars.length > MAX_CHART_POINTS

  if (
    bars.length === 0 ||
    first === undefined ||
    last === undefined ||
    priceDomain === undefined
  ) {
    return (
      <div className="flex h-full min-h-[360px] items-center justify-center text-muted-foreground max-md:min-h-[280px]">
        No bars to chart
      </div>
    )
  }

  const summary = `${symbol} ${mode === 'eod' ? 'EOD' : 'intraday'}: ${bars.length.toLocaleString()} bars from ${formatFull(bars[0].date)} to ${formatFull(bars[bars.length - 1].date)}. Last close ${numberFormat.format(bars[bars.length - 1].close)}.${downsampled ? ` Chart shows ${points.length} aggregated candles.` : ''}`

  return (
    <div className="relative flex h-full min-h-[360px] w-full flex-1 flex-col max-md:min-h-[280px]">
      <p className="sr-only">{summary}</p>
      <ChartContainer
        config={chartConfig}
        className="aspect-auto h-full min-h-[360px] w-full max-md:min-h-[280px]"
      >
        <ComposedChart accessibilityLayer data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid xAxisId="price" vertical={false} stroke="var(--border)" />
          <XAxis
            xAxisId="price"
            dataKey="label"
            tickLine={false}
            axisLine={false}
            minTickGap={24}
            tickMargin={8}
          />
          <XAxis xAxisId="volume" dataKey="label" hide />
          <YAxis
            yAxisId="price"
            orientation="right"
            tickLine={false}
            axisLine={false}
            width={64}
            domain={priceDomain}
            allowDataOverflow
            tickFormatter={(value: number) => numberFormat.format(value)}
          />
          <YAxis
            yAxisId="volume"
            orientation="left"
            hide
            domain={[0, maxVolume === 0 ? 1 : maxVolume * 5]}
          />
          <ChartTooltip content={<OhlcvTooltip />} />
          <RechartsBar
            xAxisId="volume"
            yAxisId="volume"
            dataKey="volume"
            shape={VolumeBody}
            isAnimationActive={false}
            maxBarSize={12}
          />
          <RechartsBar
            xAxisId="price"
            yAxisId="price"
            dataKey={wickRange}
            shape={CandleShape}
            isAnimationActive={false}
            maxBarSize={12}
          />
        </ComposedChart>
      </ChartContainer>
    </div>
  )
}
