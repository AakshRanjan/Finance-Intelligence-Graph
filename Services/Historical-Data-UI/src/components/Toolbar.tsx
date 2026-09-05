import { CHART_INTERVALS, type ChartInterval, type Mode, type SymbolInfo } from '../api/types'

interface ToolbarProps {
  mode: Mode
  symbol: string
  from: string
  to: string
  interval: ChartInterval
  catalog: SymbolInfo[]
  loading: boolean
  onModeChange: (mode: Mode) => void
  onSymbolChange: (symbol: string) => void
  onFromChange: (from: string) => void
  onToChange: (to: string) => void
  onIntervalChange: (interval: ChartInterval) => void
  onLoad: () => void
}

export function Toolbar({
  mode,
  symbol,
  from,
  to,
  interval,
  catalog,
  loading,
  onModeChange,
  onSymbolChange,
  onFromChange,
  onToChange,
  onIntervalChange,
  onLoad,
}: ToolbarProps) {
  const listed = catalog.find(
    (item) => item.symbol === symbol.trim().toUpperCase(),
  )

  return (
    <form
      className="toolbar"
      onSubmit={(event) => {
        event.preventDefault()
        onLoad()
      }}
    >
      <fieldset className="mode-toggle" aria-label="Bar type">
        <label>
          <input
            type="radio"
            name="mode"
            value="eod"
            checked={mode === 'eod'}
            onChange={() => onModeChange('eod')}
          />
          EOD
        </label>
        <label>
          <input
            type="radio"
            name="mode"
            value="intraday"
            checked={mode === 'intraday'}
            onChange={() => onModeChange('intraday')}
          />
          Intraday
        </label>
      </fieldset>

      <label className="field">
        Symbol
        <input
          list="symbol-options"
          value={symbol}
          onChange={(event) => onSymbolChange(event.target.value)}
          placeholder="AAPL"
          autoCapitalize="characters"
          spellCheck={false}
          required
        />
        <datalist id="symbol-options">
          {catalog.map((item) => (
            <option key={item.symbol} value={item.symbol} />
          ))}
        </datalist>
      </label>

      {mode === 'intraday' ? (
        <label className="field">
          Interval
          <select
            value={interval}
            onChange={(event) =>
              onIntervalChange(event.target.value as ChartInterval)
            }
          >
            {CHART_INTERVALS.map((option) => {
              const unavailable =
                listed !== undefined &&
                !listed.intraday_intervals.includes(option)
              return (
                <option key={option} value={option} disabled={unavailable}>
                  {option}
                  {unavailable ? ' (no data)' : ''}
                </option>
              )
            })}
          </select>
        </label>
      ) : null}

      <label className="field">
        From
        <input
          type="date"
          value={from}
          onChange={(event) => onFromChange(event.target.value)}
          required
        />
      </label>

      <label className="field">
        To
        <input
          type="date"
          value={to}
          onChange={(event) => onToChange(event.target.value)}
          required
        />
      </label>

      <button type="submit" disabled={loading || symbol.trim() === ''}>
        {loading ? 'Loading…' : 'Load'}
      </button>
    </form>
  )
}
