import type { Bar, EodBar, Mode } from '../api/types'

interface BarsTableProps {
  bars: Bar[]
  mode: Mode
}

const numberFormat = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 4,
})
const volumeFormat = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
})

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '—'
  }
  return numberFormat.format(value)
}

export function BarsTable({ bars, mode }: BarsTableProps) {
  const rows = [...bars].reverse()

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Open</th>
            <th>High</th>
            <th>Low</th>
            <th>Close</th>
            <th>Volume</th>
            {mode === 'eod' ? (
              <>
                <th>Change</th>
                <th>Change %</th>
                <th>VWAP</th>
              </>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((bar) => {
            const eod = mode === 'eod' ? (bar as EodBar) : null
            return (
              <tr key={bar.date}>
                <td className="mono">
                  {bar.date.replace('T', ' ').replace('+00:00', ' UTC')}
                </td>
                <td className="mono">{formatNumber(bar.open)}</td>
                <td className="mono">{formatNumber(bar.high)}</td>
                <td className="mono">{formatNumber(bar.low)}</td>
                <td className="mono">{formatNumber(bar.close)}</td>
                <td className="mono">{volumeFormat.format(bar.volume)}</td>
                {eod !== null ? (
                  <>
                    <td className="mono">{formatNumber(eod.change)}</td>
                    <td className="mono">{formatNumber(eod.changePercent)}</td>
                    <td className="mono">{formatNumber(eod.vwap)}</td>
                  </>
                ) : null}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
