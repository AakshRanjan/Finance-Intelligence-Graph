import type { ChartInterval, EodBar, IntradayBar, SymbolCatalog } from './types'

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function buildUrl(
  path: string,
  query?: Record<string, string | undefined>,
): string {
  const params = new URLSearchParams()
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') {
        params.set(key, value)
      }
    }
  }
  const suffix = params.size > 0 ? `?${params.toString()}` : ''
  return `${API_BASE}${path}${suffix}`
}

export function isAbortError(cause: unknown): boolean {
  return (
    (cause instanceof DOMException && cause.name === 'AbortError') ||
    (cause instanceof Error && cause.name === 'AbortError')
  )
}

async function getJson<T>(
  path: string,
  query?: Record<string, string | undefined>,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(buildUrl(path, query), { signal })
  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`
    try {
      const body: unknown = await response.json()
      if (
        typeof body === 'object' &&
        body !== null &&
        'detail' in body &&
        typeof body.detail === 'string'
      ) {
        detail = body.detail
      }
    } catch {
      // keep status text
    }
    throw new ApiError(detail, response.status)
  }
  return (await response.json()) as T
}

export async function fetchHealth(signal?: AbortSignal): Promise<void> {
  await getJson('/health', undefined, signal)
}

export async function fetchSymbols(signal?: AbortSignal): Promise<SymbolCatalog> {
  return getJson<SymbolCatalog>('/v1/symbols', undefined, signal)
}

export async function fetchEod(
  symbol: string,
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<EodBar[]> {
  return getJson<EodBar[]>(
    `/v1/eod/${encodeURIComponent(symbol)}`,
    { from, to },
    signal,
  )
}

export async function fetchIntraday(
  symbol: string,
  interval: ChartInterval,
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<IntradayBar[]> {
  return getJson<IntradayBar[]>(
    `/v1/intraday/${encodeURIComponent(symbol)}`,
    {
      interval,
      from,
      to,
    },
    signal,
  )
}
