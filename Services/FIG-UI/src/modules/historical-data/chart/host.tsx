import type { ReactNode } from 'react'

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
    </div>
  )
}
