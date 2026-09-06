import {
  HistogramSeries,
  LineSeries,
  LineType,
  createSeriesMarkers,
  type HistogramData,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type MouseEventParams,
  type Time,
  type WhitespaceData,
} from 'lightweight-charts'
import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react'

import type {
  CorporateAction,
  CorporateActionKind,
  Dividend,
  Earning,
  EarningsMetric,
  Split,
} from '@/modules/historical-data/api/types'
import { ChartFrame } from '@/modules/historical-data/chart/host'
import { useLightweightChart } from '@/modules/historical-data/chart/use-lightweight-chart'
import type { ChartScale } from '@/modules/historical-data/chart/scale'
import {
  DOWN_COLOR,
  LINE_COLOR,
  MUTED_SERIES_COLOR,
  UP_COLOR,
} from '@/modules/historical-data/chart/theme'
import { ChartTooltipOverlay } from '@/modules/historical-data/chart/tooltip'
import { useChartTooltip } from '@/modules/historical-data/chart/use-chart-tooltip'
import {
  uniqueByTime,
  utcDay,
  withWhitespace,
} from '@/modules/historical-data/chart/whitespace'

const numberFormat = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 4,
})
const revenueFormat = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
})
const factorFormat = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 4,
})

interface CorporateActionsChartProps {
  kind: CorporateActionKind
  rows: CorporateAction[]
  symbol: string
  from: string
  to: string
  earningsMetric: EarningsMetric
  scale: ChartScale
}

interface DividendPoint {
  time: Time
  dividend: number
  adjDividend: number
  yield: number
  frequency: string
}

interface EarningsPoint {
  time: Time
  actual: number | null
  estimated: number | null
}

interface SplitPoint {
  time: Time
  factor: number
  isEvent: boolean
  ratio?: string
  splitType?: string
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
      time: utcDay(row.date),
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
      time: utcDay(row.date),
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
  const points: SplitPoint[] = [
    {
      time: utcDay(from),
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
      time: utcDay(split.date),
      factor,
      isEvent: true,
      ratio: `${split.numerator}/${split.denominator}`,
      splitType: split.splitType,
    })
  }
  const last = points[points.length - 1]
  const toTime = utcDay(to)
  if (last !== undefined && String(last.time) < toTime) {
    points.push({
      time: toTime,
      factor: last.factor,
      isEvent: false,
    })
  }
  return uniqueByTime(points)
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="size-2 rounded-sm"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      {label}
    </span>
  )
}

function isHistogramData(data: unknown): data is HistogramData {
  return typeof data === 'object' && data !== null && 'value' in data
}

function isLineData(data: unknown): data is LineData {
  return typeof data === 'object' && data !== null && 'value' in data
}

function ChartPane({
  summary,
  legend,
  setup,
  tooltip,
}: {
  summary: string
  legend?: ReactNode
  setup: (chart: IChartApi) => void | (() => void)
  tooltip: (params: MouseEventParams<Time>) => ReactNode | null
}) {
  const { setContainer, chart } = useLightweightChart()
  const hover = useChartTooltip(chart, tooltip)

  useEffect(() => {
    if (chart === null) {
      return
    }
    return setup(chart)
  }, [chart, setup])

  return (
    <ChartFrame summary={summary} legend={legend}>
      <div className="relative min-h-[240px] w-full flex-1">
        <div ref={setContainer} className="h-full min-h-[240px] w-full" />
        <ChartTooltipOverlay hover={hover} />
      </div>
    </ChartFrame>
  )
}

function DividendsChart({
  points,
  symbol,
  scale,
}: {
  points: DividendPoint[]
  symbol: string
  scale: ChartScale
}) {
  const first = points[0]
  const last = points[points.length - 1]
  const histogramRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const lineRef = useRef<ISeriesApi<'Line'> | null>(null)
  const metaRef = useRef(new Map<string, DividendPoint>())

  const filled = useMemo(
    () => withWhitespace(points, scale, { kind: 'day' }),
    [points, scale],
  )
  const histogramData = useMemo(
    (): Array<HistogramData | WhitespaceData> =>
      filled.map((point) =>
        'dividend' in point
          ? { time: point.time, value: point.dividend, color: UP_COLOR }
          : { time: point.time },
      ),
    [filled],
  )
  const lineData = useMemo(
    (): Array<LineData | WhitespaceData> =>
      filled.map((point) =>
        'adjDividend' in point
          ? { time: point.time, value: point.adjDividend }
          : { time: point.time },
      ),
    [filled],
  )

  useEffect(() => {
    const map = new Map<string, DividendPoint>()
    for (const point of points) {
      map.set(String(point.time), point)
    }
    metaRef.current = map
  }, [points])

  const setup = useCallback(
    (chart: IChartApi) => {
      const histogram = chart.addSeries(HistogramSeries, {
        color: UP_COLOR,
        priceLineVisible: false,
        lastValueVisible: false,
      })
      const line = chart.addSeries(LineSeries, {
        color: LINE_COLOR,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      })
      histogram.setData(histogramData)
      line.setData(lineData)
      chart.timeScale().fitContent()
      histogramRef.current = histogram
      lineRef.current = line
      return () => {
        histogramRef.current = null
        lineRef.current = null
        chart.removeSeries(histogram)
        chart.removeSeries(line)
      }
    },
    [histogramData, lineData],
  )

  const tooltip = useCallback((params: MouseEventParams<Time>): ReactNode | null => {
    const histogram = histogramRef.current
    if (histogram === null) {
      return null
    }
    const data = params.seriesData.get(histogram)
    if (!isHistogramData(data)) {
      return null
    }
    const meta = metaRef.current.get(String(data.time))
    if (meta === undefined) {
      return null
    }
    return (
      <>
        <p className="font-medium text-foreground">{String(meta.time)}</p>
        <p>Dividend {formatNumber(meta.dividend)}</p>
        <p>Adj dividend {formatNumber(meta.adjDividend)}</p>
        <p>Yield {formatNumber(meta.yield)}%</p>
        <p>Frequency {meta.frequency || '—'}</p>
      </>
    )
  }, [])

  if (first === undefined || last === undefined) {
    return (
      <div className="flex h-full min-h-[280px] items-center justify-center text-muted-foreground">
        No dividends to chart
      </div>
    )
  }

  const summary = `${symbol} dividends: ${points.length.toLocaleString()} payments from ${String(first.time)} to ${String(last.time)}.`

  return (
    <ChartPane
      summary={summary}
      setup={setup}
      tooltip={tooltip}
      legend={
        <div className="flex flex-wrap gap-3 px-3 pt-2 text-xs text-muted-foreground">
          <LegendSwatch color={UP_COLOR} label="Dividend" />
          <LegendSwatch color={LINE_COLOR} label="Adj dividend" />
        </div>
      }
    />
  )
}

function EarningsChart({
  points,
  symbol,
  metric,
  scale,
}: {
  points: EarningsPoint[]
  symbol: string
  metric: EarningsMetric
  scale: ChartScale
}) {
  const first = points[0]
  const last = points[points.length - 1]
  const histogramRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const metaRef = useRef(new Map<string, EarningsPoint>())

  const filled = useMemo(
    () => withWhitespace(points, scale, { kind: 'day' }),
    [points, scale],
  )
  const histogramData = useMemo(
    (): Array<HistogramData | WhitespaceData> =>
      filled.map((point) =>
        'actual' in point && point.actual !== null
          ? { time: point.time, value: point.actual, color: UP_COLOR }
          : { time: point.time },
      ),
    [filled],
  )
  const lineData = useMemo(
    (): Array<LineData | WhitespaceData> =>
      filled.map((point) =>
        'estimated' in point && point.estimated !== null
          ? { time: point.time, value: point.estimated }
          : { time: point.time },
      ),
    [filled],
  )

  useEffect(() => {
    const map = new Map<string, EarningsPoint>()
    for (const point of points) {
      map.set(String(point.time), point)
    }
    metaRef.current = map
  }, [points])

  const setup = useCallback(
    (chart: IChartApi) => {
      const histogram = chart.addSeries(HistogramSeries, {
        color: UP_COLOR,
        priceLineVisible: false,
        lastValueVisible: false,
        priceFormat:
          metric === 'revenue'
            ? { type: 'volume' }
            : { type: 'price', precision: 4, minMove: 0.0001 },
      })
      const line = chart.addSeries(LineSeries, {
        color: MUTED_SERIES_COLOR,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      })
      histogram.setData(histogramData)
      line.setData(lineData)
      chart.timeScale().fitContent()
      histogramRef.current = histogram
      return () => {
        histogramRef.current = null
        chart.removeSeries(histogram)
        chart.removeSeries(line)
      }
    },
    [histogramData, lineData, metric],
  )

  const tooltip = useCallback(
    (params: MouseEventParams<Time>): ReactNode | null => {
      const histogram = histogramRef.current
      const time = params.time
      const meta =
        time !== undefined
          ? metaRef.current.get(String(time))
          : histogram !== null && isHistogramData(params.seriesData.get(histogram))
            ? metaRef.current.get(
                String(
                  (params.seriesData.get(histogram) as HistogramData).time,
                ),
              )
            : undefined
      if (meta === undefined) {
        return null
      }
      if (meta.actual === null && meta.estimated === null) {
        return null
      }
      const format = metric === 'revenue' ? formatRevenue : formatNumber
      const beat =
        meta.actual !== null &&
        meta.estimated !== null &&
        meta.actual >= meta.estimated
      return (
        <>
          <p className="font-medium text-foreground">{String(meta.time)}</p>
          <p>Actual {format(meta.actual)}</p>
          <p>Estimated {format(meta.estimated)}</p>
          {meta.actual !== null && meta.estimated !== null ? (
            <p>{beat ? 'Beat' : 'Miss'}</p>
          ) : null}
        </>
      )
    },
    [metric],
  )

  if (first === undefined || last === undefined) {
    return (
      <div className="flex h-full min-h-[280px] items-center justify-center text-muted-foreground">
        No earnings to chart
      </div>
    )
  }

  const metricLabel = metric === 'eps' ? 'EPS' : 'revenue'
  const summary = `${symbol} ${metricLabel}: ${points.length.toLocaleString()} reports from ${String(first.time)} to ${String(last.time)}.`

  return (
    <ChartPane
      summary={summary}
      setup={setup}
      tooltip={tooltip}
      legend={
        <div className="flex flex-wrap gap-3 px-3 pt-2 text-xs text-muted-foreground">
          <LegendSwatch color={UP_COLOR} label="Actual" />
          <LegendSwatch color={MUTED_SERIES_COLOR} label="Estimated" />
        </div>
      }
    />
  )
}

function SplitsChart({
  points,
  symbol,
  from,
  to,
  scale,
}: {
  points: SplitPoint[]
  symbol: string
  from: string
  to: string
  scale: ChartScale
}) {
  const events = useMemo(
    () => points.filter((point) => point.isEvent),
    [points],
  )
  const lineRef = useRef<ISeriesApi<'Line'> | null>(null)
  const metaRef = useRef(new Map<string, SplitPoint>())

  const filled = useMemo(
    () =>
      withWhitespace(points, scale, { kind: 'day' }, {
        from: utcDay(from),
        to: utcDay(to),
      }),
    [from, points, scale, to],
  )
  const lineData = useMemo((): Array<LineData | WhitespaceData> => {
    if (scale !== 'calendar') {
      return points.map((point) => ({ time: point.time, value: point.factor }))
    }
    let factor = 1
    return filled.map((point) => {
      if ('factor' in point) {
        factor = point.factor
        return { time: point.time, value: point.factor }
      }
      return { time: point.time, value: factor }
    })
  }, [filled, points, scale])

  useEffect(() => {
    const map = new Map<string, SplitPoint>()
    for (const point of points) {
      map.set(String(point.time), point)
    }
    metaRef.current = map
  }, [points])

  const setup = useCallback(
    (chart: IChartApi) => {
      const line = chart.addSeries(LineSeries, {
        color: UP_COLOR,
        lineWidth: 2,
        lineType: LineType.WithSteps,
        priceLineVisible: false,
        lastValueVisible: false,
      })
      line.setData(lineData)
      const markers = createSeriesMarkers(
        line,
        events.map((event) => ({
          time: event.time,
          position: 'inBar' as const,
          shape: 'circle' as const,
          color: DOWN_COLOR,
          size: 1,
        })),
      )
      chart.timeScale().fitContent()
      lineRef.current = line
      return () => {
        lineRef.current = null
        markers.detach()
        chart.removeSeries(line)
      }
    },
    [events, lineData],
  )

  const tooltip = useCallback((params: MouseEventParams<Time>): ReactNode | null => {
    const line = lineRef.current
    if (line === null) {
      return null
    }
    const data = params.seriesData.get(line)
    if (!isLineData(data)) {
      return null
    }
    const meta = metaRef.current.get(String(data.time))
    return (
      <>
        <p className="font-medium text-foreground">{String(data.time)}</p>
        {meta?.isEvent === true ? (
          <>
            <p>Ratio {meta.ratio ?? '—'}</p>
            <p>Type {meta.splitType || '—'}</p>
          </>
        ) : null}
        <p>1 share became {factorFormat.format(data.value)}</p>
      </>
    )
  }, [])

  if (events.length === 0) {
    return (
      <div className="flex h-full min-h-[280px] items-center justify-center text-muted-foreground">
        No splits to chart
      </div>
    )
  }

  const lastEvent = events[events.length - 1]
  const lastFactor = lastEvent?.factor ?? 1
  const summary = `${symbol} splits: ${events.length.toLocaleString()} events. 1 share became ${factorFormat.format(lastFactor)}.`

  return (
    <ChartPane
      summary={summary}
      setup={setup}
      tooltip={tooltip}
      legend={
        <div className="flex flex-wrap gap-3 px-3 pt-2 text-xs text-muted-foreground">
          <LegendSwatch color={UP_COLOR} label="Share factor" />
        </div>
      }
    />
  )
}

export function CorporateActionsChart({
  kind,
  rows,
  symbol,
  from,
  to,
  earningsMetric,
  scale,
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
    return (
      <DividendsChart points={dividendPoints} symbol={symbol} scale={scale} />
    )
  }
  if (kind === 'earnings') {
    return (
      <EarningsChart
        points={earningsPoints}
        symbol={symbol}
        metric={earningsMetric}
        scale={scale}
      />
    )
  }
  return (
    <SplitsChart
      points={splitPoints}
      symbol={symbol}
      from={from}
      to={to}
      scale={scale}
    />
  )
}
