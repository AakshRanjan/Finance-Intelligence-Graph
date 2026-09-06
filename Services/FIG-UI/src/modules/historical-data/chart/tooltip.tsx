import type { ReactNode } from 'react'

export interface ChartHover {
  x: number
  y: number
  content: ReactNode
}

export function ChartTooltipOverlay({ hover }: { hover: ChartHover | null }) {
  if (hover === null) {
    return null
  }
  return (
    <div
      className="pointer-events-none absolute z-10 grid min-w-40 max-w-64 gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs shadow-md"
      style={{
        left: hover.x + 12,
        top: hover.y + 12,
      }}
    >
      {hover.content}
    </div>
  )
}
