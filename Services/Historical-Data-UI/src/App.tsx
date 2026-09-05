import { useCallback, useEffect, useState } from 'react'

import {
  fetchEod,
  fetchHealth,
  fetchIntraday,
  fetchSymbols,
} from './api/client'
import { defaultRange, rangeQuery } from './api/dates'
import {
  API_BAR_LIMIT,
  CHART_INTERVALS,
  type Bar,
  type ChartInterval,
  type Mode,
  type SymbolInfo,
} from './api/types'
import { BarsTable } from './components/BarsTable'
import { PriceChart } from './components/PriceChart'
import { StatusBanner } from './components/StatusBanner'
import { Toolbar } from './components/Toolbar'

function firstAvailableInterval(
  listed: SymbolInfo | undefined,
  current: ChartInterval,
): ChartInterval {
  if (listed === undefined || listed.intraday_intervals.length === 0) {
    return current
  }
  if (listed.intraday_intervals.includes(current)) {
    return current
  }
  return (
    CHART_INTERVALS.find((option) => listed.intraday_intervals.includes(option)) ??
    current
  )
}

interface LoadParams {
  symbol: string
  mode: Mode
  from: string
  to: string
  interval: ChartInterval
}

export default function App() {
  const initial = defaultRange('eod')
  const [mode, setMode] = useState<Mode>('eod')
  const [symbol, setSymbol] = useState('')
  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)
  const [interval, setInterval] = useState<ChartInterval>('1hour')
  const [catalog, setCatalog] = useState<SymbolInfo[]>([])
  const [bars, setBars] = useState<Bar[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [catalogReady, setCatalogReady] = useState(false)

  const listed = catalog.find(
    (item) => item.symbol === symbol.trim().toUpperCase(),
  )

  const loadBars = useCallback(async (params: LoadParams) => {
    const trimmed = params.symbol.trim().toUpperCase()
    if (trimmed === '') {
      setError('Enter a symbol.')
      return
    }
    setLoading(true)
    setError(null)
    setInfo(null)
    try {
      const query = rangeQuery(params.mode, params.from, params.to)
      const result =
        params.mode === 'eod'
          ? await fetchEod(trimmed, query.from, query.to)
          : await fetchIntraday(
              trimmed,
              params.interval,
              query.from,
              query.to,
            )
      setBars(result)
      setSymbol(trimmed)
      if (result.length === 0) {
        setInfo(`No ${params.mode} bars for ${trimmed} in this range.`)
      } else if (result.length >= API_BAR_LIMIT) {
        setInfo(
          `Showing the first ${API_BAR_LIMIT.toLocaleString()} bars (API limit). Narrow the date range to see the rest.`,
        )
      }
    } catch (cause) {
      setBars([])
      setError(cause instanceof Error ? cause.message : 'Failed to load bars.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const catalogResponse = await fetchSymbols()
        if (cancelled) {
          return
        }
        setCatalog(catalogResponse.items)
        if (catalogResponse.items.length === 0) {
          setInfo('No symbols ingested yet. Type a symbol or run the ingester.')
          return
        }
        const preferred =
          catalogResponse.items.find((item) => item.eod) ??
          catalogResponse.items[0]
        const nextMode: Mode = preferred.eod ? 'eod' : 'intraday'
        const range = defaultRange(nextMode)
        const nextInterval = firstAvailableInterval(preferred, '1hour')
        setSymbol(preferred.symbol)
        setMode(nextMode)
        setFrom(range.from)
        setTo(range.to)
        setInterval(nextInterval)
        await loadBars({
          symbol: preferred.symbol,
          mode: nextMode,
          from: range.from,
          to: range.to,
          interval: nextInterval,
        })
      } catch {
        if (cancelled) {
          return
        }
        try {
          await fetchHealth()
          setError('Could not load the symbol catalog.')
        } catch {
          setError(
            'Historical Data API is unreachable. Is it running on port 8000?',
          )
        }
      } finally {
        if (!cancelled) {
          setCatalogReady(true)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loadBars])

  function handleModeChange(next: Mode) {
    const range = defaultRange(next)
    const nextInterval = firstAvailableInterval(listed, interval)
    setMode(next)
    setFrom(range.from)
    setTo(range.to)
    setInterval(nextInterval)
    setBars([])
    setInfo(null)
    setError(null)
  }

  function handleSymbolChange(next: string) {
    setSymbol(next)
    const match = catalog.find(
      (item) => item.symbol === next.trim().toUpperCase(),
    )
    setInterval((current) => firstAvailableInterval(match, current))
  }

  const chartPlaceholder =
    !catalogReady || (loading && bars.length === 0)
      ? 'Loading…'
      : bars.length === 0
        ? 'Load a symbol to see the chart'
        : null

  return (
    <div className="page">
      <header className="header">
        <h1>Historical Data</h1>
        <p>OHLCV bars from TimescaleDB via the Historical Data API.</p>
      </header>

      <Toolbar
        mode={mode}
        symbol={symbol}
        from={from}
        to={to}
        interval={interval}
        catalog={catalog}
        loading={loading}
        onModeChange={handleModeChange}
        onSymbolChange={handleSymbolChange}
        onFromChange={setFrom}
        onToChange={setTo}
        onIntervalChange={setInterval}
        onLoad={() => {
          void loadBars({ symbol, mode, from, to, interval })
        }}
      />

      {error ? <StatusBanner message={error} tone="error" /> : null}
      {info && !error ? <StatusBanner message={info} /> : null}
      {loading && bars.length > 0 ? (
        <StatusBanner message="Loading bars…" />
      ) : null}

      <section className="chart-panel" aria-label="Price chart">
        {chartPlaceholder !== null ? (
          <div className="chart-empty">{chartPlaceholder}</div>
        ) : (
          <PriceChart bars={bars} mode={mode} />
        )}
      </section>

      {bars.length > 0 ? <BarsTable bars={bars} mode={mode} /> : null}
    </div>
  )
}
