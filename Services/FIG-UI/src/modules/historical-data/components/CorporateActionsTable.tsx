import { useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

import type {
  CorporateAction,
  CorporateActionKind,
  Dividend,
  Earning,
  Split,
} from '@/modules/historical-data/api/types'
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

interface CorporateActionsTableProps {
  kind: CorporateActionKind
  rows: CorporateAction[]
  symbol: string
}

const numberFormat = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 4,
})
const revenueFormat = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
})
const ROW_HEIGHT = 36

const KIND_LABEL: Record<CorporateActionKind, string> = {
  dividends: 'dividends',
  earnings: 'earnings',
  splits: 'splits',
}

const COLUMN_COUNT: Record<CorporateActionKind, number> = {
  dividends: 8,
  earnings: 6,
  splits: 3,
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

function formatYield(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '—'
  }
  return `${numberFormat.format(value)}%`
}

function formatDate(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '—'
  }
  return value.slice(0, 10)
}

const numericHead =
  'sticky top-0 z-10 bg-muted text-right text-xs font-medium tracking-wide text-muted-foreground uppercase'
const textHead =
  'sticky top-0 z-10 bg-muted text-xs font-medium tracking-wide text-muted-foreground uppercase'
const numericCell = 'text-right font-mono tabular-nums'

function DividendHeaders() {
  return (
    <>
      <TableHead scope="col" className={numericHead}>
        Dividend
      </TableHead>
      <TableHead scope="col" className={numericHead}>
        Adj dividend
      </TableHead>
      <TableHead scope="col" className={numericHead}>
        Yield
      </TableHead>
      <TableHead scope="col" className={textHead}>
        Frequency
      </TableHead>
      <TableHead scope="col" className={textHead}>
        Declaration
      </TableHead>
      <TableHead scope="col" className={textHead}>
        Record
      </TableHead>
      <TableHead scope="col" className={textHead}>
        Payment
      </TableHead>
    </>
  )
}

function EarningsHeaders() {
  return (
    <>
      <TableHead scope="col" className={numericHead}>
        EPS actual
      </TableHead>
      <TableHead scope="col" className={numericHead}>
        EPS est.
      </TableHead>
      <TableHead scope="col" className={numericHead}>
        Revenue actual
      </TableHead>
      <TableHead scope="col" className={numericHead}>
        Revenue est.
      </TableHead>
      <TableHead scope="col" className={textHead}>
        Last updated
      </TableHead>
    </>
  )
}

function SplitsHeaders() {
  return (
    <>
      <TableHead scope="col" className={numericHead}>
        Ratio
      </TableHead>
      <TableHead scope="col" className={textHead}>
        Type
      </TableHead>
    </>
  )
}

function DividendCells({ row }: { row: Dividend }) {
  return (
    <>
      <TableCell className={numericCell}>{formatNumber(row.dividend)}</TableCell>
      <TableCell className={numericCell}>
        {formatNumber(row.adjDividend)}
      </TableCell>
      <TableCell className={numericCell}>{formatYield(row.yield)}</TableCell>
      <TableCell>{row.frequency || '—'}</TableCell>
      <TableCell className="font-mono tabular-nums">
        {formatDate(row.declarationDate)}
      </TableCell>
      <TableCell className="font-mono tabular-nums">
        {formatDate(row.recordDate)}
      </TableCell>
      <TableCell className="font-mono tabular-nums">
        {formatDate(row.paymentDate)}
      </TableCell>
    </>
  )
}

function EarningsCells({ row }: { row: Earning }) {
  return (
    <>
      <TableCell className={numericCell}>
        {formatNumber(row.epsActual)}
      </TableCell>
      <TableCell className={numericCell}>
        {formatNumber(row.epsEstimated)}
      </TableCell>
      <TableCell className={numericCell}>
        {formatRevenue(row.revenueActual)}
      </TableCell>
      <TableCell className={numericCell}>
        {formatRevenue(row.revenueEstimated)}
      </TableCell>
      <TableCell className="font-mono tabular-nums">
        {formatDate(row.lastUpdated)}
      </TableCell>
    </>
  )
}

function SplitsCells({ row }: { row: Split }) {
  return (
    <>
      <TableCell className={numericCell}>
        {`${row.numerator}/${row.denominator}`}
      </TableCell>
      <TableCell>{row.splitType || '—'}</TableCell>
    </>
  )
}

function KindCells({
  kind,
  row,
}: {
  kind: CorporateActionKind
  row: CorporateAction
}) {
  if (kind === 'dividends') {
    return <DividendCells row={row as Dividend} />
  }
  if (kind === 'earnings') {
    return <EarningsCells row={row as Earning} />
  }
  return <SplitsCells row={row as Split} />
}

export function CorporateActionsTable({
  kind,
  rows: source,
  symbol,
}: CorporateActionsTableProps) {
  const rows = useMemo(() => [...source].reverse(), [source])
  const scrollRef = useRef<HTMLDivElement>(null)
  const columnCount = COLUMN_COUNT[kind]
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
  const label = KIND_LABEL[kind]

  return (
    <Card
      className="overflow-hidden py-0"
      role="region"
      aria-labelledby="corporate-actions-caption"
    >
      <p className="px-3 py-2 text-xs text-muted-foreground">
        {rows.length.toLocaleString()} {label}
      </p>
      <div
        ref={scrollRef}
        className="max-h-[70vh] overflow-auto [&_[data-slot=table-container]]:overflow-visible"
      >
        <Table>
          <TableCaption id="corporate-actions-caption" className="sr-only">
            {symbol} {label} table, {rows.length.toLocaleString()} rows, newest
            first.
          </TableCaption>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead
                scope="col"
                className="sticky top-0 left-0 z-20 bg-muted text-xs font-medium tracking-wide text-muted-foreground uppercase"
              >
                Date
              </TableHead>
              {kind === 'dividends' ? <DividendHeaders /> : null}
              {kind === 'earnings' ? <EarningsHeaders /> : null}
              {kind === 'splits' ? <SplitsHeaders /> : null}
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
              const row = rows[virtualRow.index]
              return (
                <TableRow key={`${row.symbol}-${row.date}`} style={{ height: ROW_HEIGHT }}>
                  <TableCell className="sticky left-0 bg-card font-mono tabular-nums">
                    {formatDate(row.date)}
                  </TableCell>
                  <KindCells kind={kind} row={row} />
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
