import { useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

import type { Bar, EodBar, Mode } from '@/api/types'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface BarsTableProps {
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
const ROW_HEIGHT = 36

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '—'
  }
  return numberFormat.format(value)
}

function formatDate(date: string): string {
  return date.replace('T', ' ').replace('+00:00', ' UTC')
}

const numericHead =
  'sticky top-0 z-10 bg-muted text-right text-xs font-medium tracking-wide text-muted-foreground uppercase'
const numericCell = 'text-right font-mono tabular-nums'

export function BarsTable({ bars, mode, symbol }: BarsTableProps) {
  const rows = useMemo(() => [...bars].reverse(), [bars])
  const scrollRef = useRef<HTMLDivElement>(null)
  const columnCount = mode === 'eod' ? 9 : 6
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 16,
  })
  const virtualRows = virtualizer.getVirtualItems()
  const paddingTop = virtualRows[0]?.start ?? 0
  const last = virtualRows[virtualRows.length - 1]
  const paddingBottom =
    last === undefined ? 0 : virtualizer.getTotalSize() - last.end

  return (
    <Card className="overflow-hidden py-0" role="region" aria-labelledby="bars-caption">
      <p className="px-3 py-2 text-xs text-muted-foreground">
        {rows.length.toLocaleString()} bars
      </p>
      <div
        ref={scrollRef}
        className="max-h-[34vh] overflow-auto [&_[data-slot=table-container]]:overflow-visible"
      >
        <Table>
          <TableCaption id="bars-caption" className="sr-only">
            {symbol} {mode === 'eod' ? 'EOD' : 'intraday'} OHLCV table,{' '}
            {rows.length.toLocaleString()} rows, newest first.
          </TableCaption>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead
                scope="col"
                className="sticky top-0 left-0 z-20 bg-muted text-xs font-medium tracking-wide text-muted-foreground uppercase"
              >
                Date
              </TableHead>
              <TableHead scope="col" className={numericHead}>
                Open
              </TableHead>
              <TableHead scope="col" className={numericHead}>
                High
              </TableHead>
              <TableHead scope="col" className={numericHead}>
                Low
              </TableHead>
              <TableHead scope="col" className={numericHead}>
                Close
              </TableHead>
              <TableHead scope="col" className={numericHead}>
                Volume
              </TableHead>
              {mode === 'eod' ? (
                <>
                  <TableHead scope="col" className={numericHead}>
                    Change
                  </TableHead>
                  <TableHead scope="col" className={numericHead}>
                    Change %
                  </TableHead>
                  <TableHead scope="col" className={numericHead}>
                    VWAP
                  </TableHead>
                </>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paddingTop > 0 ? (
              <TableRow aria-hidden className="hover:bg-transparent">
                <TableCell
                  colSpan={columnCount}
                  className="p-0"
                  style={{ height: paddingTop }}
                />
              </TableRow>
            ) : null}
            {virtualRows.map((virtualRow) => {
              const bar = rows[virtualRow.index]
              const eod = mode === 'eod' ? (bar as EodBar) : null
              return (
                <TableRow key={bar.date} style={{ height: ROW_HEIGHT }}>
                  <TableCell className="sticky left-0 bg-card font-mono tabular-nums">
                    {formatDate(bar.date)}
                  </TableCell>
                  <TableCell className={numericCell}>
                    {formatNumber(bar.open)}
                  </TableCell>
                  <TableCell className={numericCell}>
                    {formatNumber(bar.high)}
                  </TableCell>
                  <TableCell className={numericCell}>
                    {formatNumber(bar.low)}
                  </TableCell>
                  <TableCell className={numericCell}>
                    {formatNumber(bar.close)}
                  </TableCell>
                  <TableCell className={numericCell}>
                    {volumeFormat.format(bar.volume)}
                  </TableCell>
                  {eod !== null ? (
                    <>
                      <TableCell className={numericCell}>
                        {formatNumber(eod.change)}
                      </TableCell>
                      <TableCell className={numericCell}>
                        {formatNumber(eod.changePercent)}
                      </TableCell>
                      <TableCell className={numericCell}>
                        {formatNumber(eod.vwap)}
                      </TableCell>
                    </>
                  ) : null}
                </TableRow>
              )
            })}
            {paddingBottom > 0 ? (
              <TableRow aria-hidden className="hover:bg-transparent">
                <TableCell
                  colSpan={columnCount}
                  className="p-0"
                  style={{ height: paddingBottom }}
                />
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </Card>
  )
}
