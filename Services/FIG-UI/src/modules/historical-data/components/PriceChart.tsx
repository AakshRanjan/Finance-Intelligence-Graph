import {
  CandlestickSeries,
  CrosshairMode,
  HistogramSeries,
  type CandlestickData,
  type HistogramData,
  type ISeriesApi,
  type MouseEventParams,
  type Time,
  type WhitespaceData,
} from 'lightweight-charts'
import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react'

import type {
  Bar,
  ChartInterval,
  EodBar,
  Mode,
} from '@/modules/historical-data/api/types'
import { ChartFrame } from '@/modules/historical-data/chart/host'
import { useLightweightChart } from '@/modules/historical-data/chart/use-lightweight-chart'
import type { ChartScale } from '@/modules/historical-data/chart/scale'
import { ChartTooltipOverlay } from '@/modules/historical-data/chart/tooltip'
import { useChartTooltip } from '@/modules/historical-data/chart/use-chart-tooltip'
import {
  barTime,
  intervalStep,
  uniqueByTime,
  withWhitespace,
} from '@/modules/historical-data/chart/whitespace'

interface PriceChartProps {
  bars: Bar[]
  mode: Mode
  symbol: string
  interval: ChartInterval
  scale: ChartScale
}

interface CandlePoint extends CandlestickData {
  volume: number
  up: boolean
  changePercent?: number | null
}

const numberFormat = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 4,
})
const volumeFormat = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
})
const percentFormat = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
  signDisplay: 'exceptZero',
})

function formatFull(date: string): string {
  return date.replace('T', ' ').replace('+00:00', ' UTC')
}

function formatTime(time: Time): string {
  if (typeof time === 'number') {
    return new Date(time * 1000)
      .toISOString()
      .replace('T', ' ')
      .replace('.000Z', ' UTC')
  }
  if (typeof time === 'object') {
    const month = String(time.month).padStart(2, '0')
    const day = String(time.day).padStart(2, '0')
    return `${time.year}-${month}-${day}`
  }
  return time
}

function toCandle(bar: Bar, mode: Mode): CandlePoint {
  const eod = mode === 'eod' ? (bar as EodBar) : null
  return {
    time: barTime(bar.date, mode),
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume,
    up: bar.close >= bar.open,
    changePercent: eod?.changePercent,
  }
}

function isCandleData(
  data: unknown,
): data is CandlestickData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'open' in data &&
    'high' in data &&
    'low' in data &&
    'close' in data
  )
}

export function PriceChart({
  bars,
  mode,
  symbol,
  interval,
  scale,
}: PriceChartProps) {
  const { setContainer, chart, theme } = useLightweightChart()
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const metaByTime = useRef(new Map<string, CandlePoint>())

  const candles = useMemo(
    () => uniqueByTime(bars.map((bar) => toCandle(bar, mode))),
    [bars, mode],
  )
  const filled = useMemo(
    () => withWhitespace(candles, scale, intervalStep(mode, interval)),
    [candles, interval, mode, scale],
  )

  const candleData = useMemo(
    () =>
      filled.map((point) => {
        if ('open' in point) {
          const { time, open, high, low, close } = point
          return { time, open, high, low, close }
        }
        return { time: point.time } satisfies WhitespaceData
      }),
    [filled],
  )
  const volumeData = useMemo(
    (): Array<HistogramData | WhitespaceData> =>
      filled.map((point) => {
        if ('open' in point) {
          return {
            time: point.time,
            value: point.volume,
            color: point.up ? theme.up : theme.down,
          }
        }
        return { time: point.time }
      }),
    [filled, theme.down, theme.up],
  )

  useEffect(() => {
    const map = new Map<string, CandlePoint>()
    for (const candle of candles) {
      map.set(String(candle.time), candle)
    }
    metaByTime.current = map
  }, [candles])

  useEffect(() => {
    if (chart === null) {
      return
    }
    chart.applyOptions({
      crosshair: { mode: CrosshairMode.Magnet },
      timeScale: {
        timeVisible: mode === 'intraday',
        secondsVisible: false,
      },
      localization: {
        locale: 'en-US',
      },
    })
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: theme.up,
      downColor: theme.down,
      borderUpColor: theme.up,
      borderDownColor: theme.down,
      wickUpColor: theme.up,
      wickDownColor: theme.down,
    })
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
      lastValueVisible: false,
      priceLineVisible: false,
    })
    chart.priceScale('right').applyOptions({
      scaleMargins: { top: 0.05, bottom: 0.22 },
      borderVisible: false,
    })
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
      borderVisible: false,
      visible: false,
    })
    candleSeries.setData(candleData)
    volumeSeries.setData(volumeData)
    chart.timeScale().fitContent()
    candleSeriesRef.current = candleSeries
    return () => {
      candleSeriesRef.current = null
      chart.removeSeries(candleSeries)
      chart.removeSeries(volumeSeries)
    }
  }, [candleData, chart, mode, theme, volumeData])

  const renderTooltip = useCallback(
    (params: MouseEventParams<Time>): ReactNode | null => {
      const series = candleSeriesRef.current
      if (series === null) {
        return null
      }
      const data = params.seriesData.get(series)
      if (!isCandleData(data)) {
        return null
      }
      const meta = metaByTime.current.get(String(data.time))
      const volume = meta?.volume
      const changePercent = meta?.changePercent
      return (
        <>
          <p className="font-medium text-foreground">
            {params.time !== undefined ? formatTime(params.time) : ''}
          </p>
          <p>Open {numberFormat.format(data.open)}</p>
          <p>High {numberFormat.format(data.high)}</p>
          <p>Low {numberFormat.format(data.low)}</p>
          <p>Close {numberFormat.format(data.close)}</p>
          {volume !== undefined ? <p>Volume {volumeFormat.format(volume)}</p> : null}
          {changePercent !== null && changePercent !== undefined ? (
            <p>Change {percentFormat.format(changePercent)}%</p>
          ) : null}
        </>
      )
    },
    [],
  )
  const hover = useChartTooltip(chart, renderTooltip)

  const first = bars[0]
  const last = bars[bars.length - 1]
  if (first === undefined || last === undefined) {
    return (
      <div className="flex h-full min-h-[360px] items-center justify-center text-muted-foreground max-md:min-h-[280px]">
        No bars to chart
      </div>
    )
  }

  const summary = `${symbol} ${mode === 'eod' ? 'EOD' : 'intraday'}: ${bars.length.toLocaleString()} bars from ${formatFull(first.date)} to ${formatFull(last.date)}. Last close ${numberFormat.format(last.close)}.`

  return (
    <ChartFrame
      className="relative flex h-full min-h-[360px] w-full flex-1 flex-col max-md:min-h-[280px]"
      summary={summary}
    >
      <div className="relative min-h-[280px] w-full flex-1">
        <div ref={setContainer} className="h-full min-h-[280px] w-full" />
        <ChartTooltipOverlay hover={hover} />
      </div>
    </ChartFrame>
  )
}
