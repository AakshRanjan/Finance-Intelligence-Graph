import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2Icon } from 'lucide-react'

import {
  fetchDividends,
  fetchEarnings,
  fetchHealth,
  fetchSplits,
  fetchSymbols,
  isAbortError,
} from '@/modules/historical-data/api/client'
import {
  defaultCorporateActionRange,
  rangeFromPreset,
  type CorporateActionPreset,
} from '@/modules/historical-data/api/dates'
import {
  API_CORPORATE_ACTION_LIMIT,
  type CorporateAction,
  type CorporateActionKind,
  type EarningsMetric,
  type SymbolInfo,
} from '@/modules/historical-data/api/types'
import { CorporateActionsChart } from '@/modules/historical-data/components/CorporateActionsChart'
import { CorporateActionsTable } from '@/modules/historical-data/components/CorporateActionsTable'
import { CorporateActionsToolbar } from '@/modules/historical-data/components/CorporateActionsToolbar'
import { StatusBanner } from '@/modules/historical-data/components/StatusBanner'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

const LOAD_DEBOUNCE_MS = 300
const REFRESH_MS = 5 * 60 * 1000

const KIND_LABEL: Record<CorporateActionKind, string> = {
  dividends: 'dividends',
  earnings: 'earnings',
  splits: 'splits',
}

interface LoadParams {
  symbol: string
  kind: CorporateActionKind
  from: string
  to: string
}

async function fetchByKind(
  params: LoadParams,
  signal: AbortSignal,
): Promise<CorporateAction[]> {
  const { symbol, kind, from, to } = params
  if (kind === 'dividends') {
    return fetchDividends(symbol, from, to, signal)
  }
  if (kind === 'earnings') {
    return fetchEarnings(symbol, from, to, signal)
  }
  return fetchSplits(symbol, from, to, signal)
}

export function CorporateActionsPage() {
  const initial = defaultCorporateActionRange()
  const [kind, setKind] = useState<CorporateActionKind>('dividends')
  const [earningsMetric, setEarningsMetric] = useState<EarningsMetric>('eps')
  const [symbol, setSymbol] = useState('')
  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)
  const [catalog, setCatalog] = useState<SymbolInfo[]>([])
  const [rows, setRows] = useState<CorporateAction[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [catalogReady, setCatalogReady] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const filtersRef = useRef({ symbol, kind, from, to })

  useEffect(() => {
    filtersRef.current = { symbol, kind, from, to }
  }, [symbol, kind, from, to])

  const loadRows = useCallback(async (params: LoadParams) => {
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
    const label = KIND_LABEL[params.kind]
    try {
      const result = await fetchByKind(
        { ...params, symbol: trimmed },
        controller.signal,
      )
      if (controller.signal.aborted) {
        return
      }
      setRows(result)
      setSymbol(trimmed)
      if (result.length === 0) {
        setInfo(`No ${label} for ${trimmed} in this range.`)
      } else if (result.length >= API_CORPORATE_ACTION_LIMIT) {
        setInfo(
          `Showing the first ${API_CORPORATE_ACTION_LIMIT.toLocaleString()} ${label} (API limit). Narrow the date range to see the rest.`,
        )
      }
    } catch (cause) {
      if (isAbortError(cause) || controller.signal.aborted) {
        return
      }
      setRows([])
      setError(
        cause instanceof Error ? cause.message : `Failed to load ${label}.`,
      )
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
        setSymbol(preferred.symbol)
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

  const refreshCatalogAndRows = useCallback(async () => {
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
    await loadRows(params)
  }, [loadRows])

  useEffect(() => {
    if (!catalogReady) {
      return
    }
    const timer = window.setTimeout(() => {
      void loadRows({ symbol, kind, from, to })
    }, LOAD_DEBOUNCE_MS)
    return () => {
      window.clearTimeout(timer)
    }
  }, [catalogReady, symbol, kind, from, to, loadRows])

  useEffect(() => {
    if (!catalogReady) {
      return
    }
    const timer = window.setInterval(() => {
      void refreshCatalogAndRows()
    }, REFRESH_MS)
    return () => {
      window.clearInterval(timer)
    }
  }, [catalogReady, refreshCatalogAndRows])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  function handleKindChange(next: CorporateActionKind) {
    setKind(next)
    setRows([])
    setInfo(null)
    setError(null)
  }

  function handlePreset(preset: CorporateActionPreset) {
    const range = rangeFromPreset(preset)
    setFrom(range.from)
    setTo(range.to)
  }

  const tablePlaceholder =
    !catalogReady || (loading && rows.length === 0)
      ? 'Loading…'
      : rows.length === 0
        ? 'Enter a symbol to see corporate actions'
        : null
  const tableLoading = tablePlaceholder === 'Loading…'
  const displaySymbol = symbol.trim().toUpperCase()

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col gap-4 p-4 text-foreground md:p-6">
      <a
        href="#corporate-actions-chart"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:ring-2 focus:ring-ring"
      >
        Skip to chart
      </a>

      <CorporateActionsToolbar
        kind={kind}
        symbol={symbol}
        from={from}
        to={to}
        catalog={catalog}
        earningsMetric={earningsMetric}
        onKindChange={handleKindChange}
        onSymbolChange={setSymbol}
        onFromChange={setFrom}
        onToChange={setTo}
        onPreset={handlePreset}
        onEarningsMetricChange={setEarningsMetric}
      />

      <div aria-busy={loading} className="flex min-h-0 flex-1 flex-col gap-4">
        {error ? <StatusBanner message={error} tone="error" /> : null}
        {info && !error ? <StatusBanner message={info} /> : null}

        <Card
          id="corporate-actions-chart"
          role="region"
          aria-label="Corporate actions chart"
          className="relative flex min-h-[280px] flex-1 flex-col overflow-hidden py-0 max-md:min-h-[240px]"
          style={{ flexBasis: '48vh' }}
        >
          <CardContent className="flex min-h-[280px] flex-1 p-0 max-md:min-h-[240px]">
            {tablePlaceholder !== null ? (
              <div className="flex min-h-[280px] w-full flex-1 items-center justify-center text-muted-foreground max-md:min-h-[240px]">
                {tableLoading ? (
                  <Skeleton className="h-4 w-32" />
                ) : (
                  tablePlaceholder
                )}
              </div>
            ) : (
              <CorporateActionsChart
                kind={kind}
                rows={rows}
                symbol={displaySymbol}
                from={from}
                to={to}
                earningsMetric={earningsMetric}
              />
            )}
          </CardContent>
          {loading && rows.length > 0 ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/50">
              <Loader2Icon className="size-6 animate-spin text-muted-foreground motion-reduce:animate-none" />
            </div>
          ) : null}
        </Card>

        {rows.length > 0 ? (
          <div id="corporate-actions-table">
            <CorporateActionsTable
              kind={kind}
              rows={rows}
              symbol={displaySymbol}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
