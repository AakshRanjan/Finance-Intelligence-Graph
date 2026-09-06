import type { IChartApi, MouseEventParams, Time } from 'lightweight-charts'
import { useEffect, useState, type ReactNode } from 'react'

import type { ChartHover } from '@/modules/historical-data/chart/tooltip'

export function useChartTooltip(
  chart: IChartApi | null,
  render: (params: MouseEventParams<Time>) => ReactNode | null,
): ChartHover | null {
  const [hover, setHover] = useState<ChartHover | null>(null)

  useEffect(() => {
    if (chart === null) {
      setHover(null)
      return
    }
    const handler = (params: MouseEventParams<Time>) => {
      if (params.point === undefined) {
        setHover(null)
        return
      }
      const content = render(params)
      if (content === null) {
        setHover(null)
        return
      }
      setHover({
        x: params.point.x,
        y: params.point.y,
        content,
      })
    }
    chart.subscribeCrosshairMove(handler)
    return () => {
      chart.unsubscribeCrosshairMove(handler)
      setHover(null)
    }
  }, [chart, render])

  return hover
}
