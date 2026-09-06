import { createChart, type IChartApi } from 'lightweight-charts'
import { useLayoutEffect, useRef, useState } from 'react'

import { useTheme } from '@/components/theme-provider'
import {
  chartOptionsFromTheme,
  parseUnsupportedCssColor,
  readChartTheme,
  type ChartTheme,
} from '@/modules/historical-data/chart/theme'

export function useChartTheme(): ChartTheme {
  const { resolvedTheme } = useTheme()
  const [theme, setTheme] = useState(() => readChartTheme())

  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => {
      setTheme(readChartTheme())
    })
    return () => cancelAnimationFrame(frame)
  }, [resolvedTheme])

  return theme
}

export function useLightweightChart(): {
  setContainer: (node: HTMLDivElement | null) => void
  chart: IChartApi | null
  theme: ChartTheme
} {
  const theme = useChartTheme()
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const [chart, setChart] = useState<IChartApi | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const themeRef = useRef(theme)

  useLayoutEffect(() => {
    themeRef.current = theme
    chartRef.current?.applyOptions(chartOptionsFromTheme(theme))
  }, [theme])

  useLayoutEffect(() => {
    if (container === null) {
      return
    }
    const options = chartOptionsFromTheme(themeRef.current)
    const instance = createChart(container, {
      ...options,
      layout: {
        ...options.layout,
        colorParsers: [parseUnsupportedCssColor],
      },
      width: Math.max(container.clientWidth, 1),
      height: Math.max(container.clientHeight, 1),
    })
    chartRef.current = instance
    setChart(instance)
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry === undefined) {
        return
      }
      const { width, height } = entry.contentRect
      if (width > 0 && height > 0) {
        instance.resize(width, height)
      }
    })
    observer.observe(container)
    return () => {
      observer.disconnect()
      setChart(null)
      chartRef.current = null
      instance.remove()
    }
  }, [container])

  return { setContainer, chart, theme }
}
