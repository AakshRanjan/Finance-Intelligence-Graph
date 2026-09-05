import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2Icon } from 'lucide-react'

import {
  fetchEod,
  fetchHealth,
  fetchIntraday,
  fetchSymbols,
  isAbortError,
} from '@/modules/historical-data/api/client'
import {
  defaultRange,
  rangeFromPreset,
  rangeQuery,
  type RangePreset,
} from '@/modules/historical-data/api/dates'
import {
  API_BAR_LIMIT,
  CHART_INTERVALS,
  type Bar,
  type ChartInterval,
  type Mode,
  type SymbolInfo,
} from '@/modules/historical-data/api/types'
import { BarsTable } from '@/modules/historical-data/components/BarsTable'
import { PriceChart } from '@/modules/historical-data/components/PriceChart'
import { StatusBanner } from '@/modules/historical-data/components/StatusBanner'
import { Toolbar } from '@/modules/historical-data/components/Toolbar'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

const LOAD_DEBOUNCE_MS = 300
const REFRESH_MS = 5 * 60 * 1000

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

export function HistoricalDataPage() {
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
  const abortRef = useRef<AbortController | null>(null)
  const filtersRef = useRef({ symbol, mode, from, to, interval })

  useEffect(() => {
    filtersRef.current = { symbol, mode, from, to, interval }
  }, [symbol, mode, from, to, interval])

  const listed = catalog.find(
    (item) => item.symbol === symbol.trim().toUpperCase(),
  )

  const loadBars = useCallback(async (params: LoadParams) => {
    const trimmed = params.symbol.trim().toUpperCase()
    if (trimmed === '') {
      return
    }
    if (params.from > params.to) {
      setInfo('From must be on or before To.')
      setError(null)
      return
    }
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setError(null)
    setInfo(null)
    try {
      const query = rangeQuery(params.mode, params.from, params.to)
      const result =
        params.mode === 'eod'
          ? await fetchEod(trimmed, query.from, query.to, controller.signal)
          : await fetchIntraday(
              trimmed,
              params.interval,
              query.from,
              query.to,
              controller.signal,
            )
      if (controller.signal.aborted) {
        return
      }
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
      if (isAbortError(cause) || controller.signal.aborted) {
        return
      }
      setBars([])
      setError(cause instanceof Error ? cause.message : 'Failed to load bars.')
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void (async () => {
      try {
        const catalogResponse = await fetchSymbols(controller.signal)
        if (controller.signal.aborted) {
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
      } catch (cause) {
        if (isAbortError(cause) || controller.signal.aborted) {
          return
        }
        try {
          await fetchHealth(controller.signal)
          setError('Could not load the symbol catalog.')
        } catch (healthCause) {
          if (isAbortError(healthCause) || controller.signal.aborted) {
            return
          }
          setError(
            'Historical Data API is unreachable. Is it running on port 8000?',
          )
        }
      } finally {
        if (!controller.signal.aborted) {
          setCatalogReady(true)
        }
      }
    })()
    return () => {
      controller.abort()
    }
  }, [])

  const refreshCatalogAndBars = useCallback(async () => {
    const params = filtersRef.current
    try {
      const catalogResponse = await fetchSymbols()
      setCatalog(catalogResponse.items)
      if (catalogResponse.items.length === 0) {
        setInfo('No symbols ingested yet. Type a symbol or run the ingester.')
      }
    } catch (cause) {
      if (isAbortError(cause)) {
        return
      }
      try {
        await fetchHealth()
        setError('Could not load the symbol catalog.')
      } catch (healthCause) {
        if (isAbortError(healthCause)) {
          return
        }
        setError(
          'Historical Data API is unreachable. Is it running on port 8000?',
        )
      }
      return
    }
    await loadBars(params)
  }, [loadBars])

  useEffect(() => {
    if (!catalogReady) {
      return
    }
    const timer = window.setTimeout(() => {
      void loadBars({ symbol, mode, from, to, interval })
    }, LOAD_DEBOUNCE_MS)
    return () => {
      window.clearTimeout(timer)
    }
  }, [catalogReady, symbol, mode, from, to, interval, loadBars])

  useEffect(() => {
    if (!catalogReady) {
      return
    }
    const timer = window.setInterval(() => {
      void refreshCatalogAndBars()
    }, REFRESH_MS)
    return () => {
      window.clearInterval(timer)
    }
  }, [catalogReady, refreshCatalogAndBars])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  function handleModeChange(next: Mode) {
    const range = defaultRange(next)
    const nextInterval = firstAvailableInterval(listed, interval)
    setMode(next)
    setFrom(range.from)
    setTo(range.to)
    setInterval(nextInterval)
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

  function handlePreset(preset: RangePreset) {
    const range = rangeFromPreset(preset)
    setFrom(range.from)
    setTo(range.to)
  }

  const chartPlaceholder =
    !catalogReady || (loading && bars.length === 0)
      ? 'Loading…'
      : bars.length === 0
        ? 'Enter a symbol to see the chart'
        : null
  const chartLoading = chartPlaceholder === 'Loading…'
  const displaySymbol = symbol.trim().toUpperCase()

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col gap-4 p-4 text-foreground md:p-6">
      <a
        href="#price-chart"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:ring-2 focus:ring-ring"
      >
        Skip to chart
      </a>

      <Toolbar
        mode={mode}
        symbol={symbol}
        from={from}
        to={to}
        interval={interval}
        catalog={catalog}
        onModeChange={handleModeChange}
        onSymbolChange={handleSymbolChange}
        onFromChange={setFrom}
        onToChange={setTo}
        onIntervalChange={setInterval}
        onPreset={handlePreset}
      />

      <div aria-busy={loading} className="flex min-h-0 flex-1 flex-col gap-4">
        {error ? <StatusBanner message={error} tone="error" /> : null}
        {info && !error ? <StatusBanner message={info} /> : null}

        <Card
          id="price-chart"
          role="region"
          aria-label="Price chart"
          className="relative flex min-h-[360px] flex-1 flex-col overflow-hidden py-0 max-md:min-h-[280px]"
          style={{ flexBasis: '58vh' }}
        >
          <CardContent className="flex min-h-[360px] flex-1 p-0 max-md:min-h-[280px]">
            {chartPlaceholder !== null ? (
              <div className="flex min-h-[360px] w-full flex-1 items-center justify-center text-muted-foreground max-md:min-h-[280px]">
                {chartLoading ? (
                  <Skeleton className="h-4 w-32" />
                ) : (
                  chartPlaceholder
                )}
              </div>
            ) : (
              <PriceChart bars={bars} mode={mode} symbol={displaySymbol} />
            )}
          </CardContent>
          {loading && bars.length > 0 ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/50">
              <Loader2Icon className="size-6 animate-spin text-muted-foreground motion-reduce:animate-none" />
            </div>
          ) : null}
        </Card>

        {bars.length > 0 ? (
          <BarsTable bars={bars} mode={mode} symbol={displaySymbol} />
        ) : null}
      </div>
    </div>
  )
}
