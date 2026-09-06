import type { ReactNode } from 'react'

export function ChartAttribution() {
  return (
    <p className="px-3 pb-1.5 text-[10px] leading-none text-muted-foreground">
      Charting by{' '}
      <a
        href="https://www.tradingview.com/lightweight-charts/"
        target="_blank"
        rel="noreferrer"
        className="underline-offset-2 hover:underline"
      >
        TradingView Lightweight Charts
      </a>{' '}
      (Apache-2.0)
    </p>
  )
}

export function ChartFrame({
  className,
  summary,
  legend,
  children,
}: {
  className?: string
  summary: string
  legend?: ReactNode
  children: ReactNode
}) {
  return (
    <div
      className={
        className ??
        'relative flex h-full min-h-[280px] w-full flex-1 flex-col max-md:min-h-[240px]'
      }
    >
      <p className="sr-only">{summary}</p>
      {legend}
      {children}
      <ChartAttribution />
    </div>
  )
}
