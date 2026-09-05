import {
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  createChart,
  type IChartApi,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts'
import { useEffect, useRef } from 'react'

import type { Bar, Mode } from '../api/types'

interface PriceChartProps {
  bars: Bar[]
  mode: Mode
}

function toChartTime(date: string, mode: Mode): Time {
  if (mode === 'eod') {
    const [year, month, day] = date.slice(0, 10).split('-').map(Number)
    return { year, month, day }
  }
  return Math.floor(Date.parse(date) / 1000) as UTCTimestamp
}

export function PriceChart({ bars, mode }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (container === null || bars.length === 0) {
      return
    }

    const chart: IChartApi = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: '#12141a' },
        textColor: '#9ca3af',
        fontFamily: "ui-sans-serif, system-ui, 'Segoe UI', sans-serif",
      },
      grid: {
        vertLines: { color: '#1f2330' },
        horzLines: { color: '#1f2330' },
      },
      rightPriceScale: {
        borderColor: '#2e303a',
        scaleMargins: { top: 0.08, bottom: 0.28 },
      },
      timeScale: {
        borderColor: '#2e303a',
        timeVisible: mode === 'intraday',
        secondsVisible: false,
      },
    })

    const candles = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    })

    const volume = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    })
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    })

    candles.setData(
      bars.map((bar) => ({
        time: toChartTime(bar.date, mode),
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
      })),
    )
    volume.setData(
      bars.map((bar) => ({
        time: toChartTime(bar.date, mode),
        value: bar.volume,
        color: bar.close >= bar.open ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)',
      })),
    )
    chart.timeScale().fitContent()

    return () => {
      chart.remove()
    }
  }, [bars, mode])

  if (bars.length === 0) {
    return <div className="chart-empty">No bars to chart</div>
  }

  return <div className="chart" ref={containerRef} />
}
