export const CHART_INTERVALS = [
  '1min',
  '5min',
  '15min',
  '30min',
  '1hour',
  '4hour',
] as const

export type ChartInterval = (typeof CHART_INTERVALS)[number]

export type Mode = 'eod' | 'intraday'

export interface SymbolInfo {
  symbol: string
  eod: boolean
  intraday_intervals: ChartInterval[]
}

export interface SymbolCatalog {
  items: SymbolInfo[]
}

export interface EodBar {
  symbol: string
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  change?: number | null
  changePercent?: number | null
  vwap?: number | null
}

export interface IntradayBar {
  symbol: string
  interval: ChartInterval
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export type Bar = EodBar | IntradayBar

export const API_BAR_LIMIT = 5000

export const CORPORATE_ACTION_KINDS = [
  'dividends',
  'earnings',
  'splits',
] as const

export type CorporateActionKind = (typeof CORPORATE_ACTION_KINDS)[number]

export const EARNINGS_METRICS = ['eps', 'revenue'] as const

export type EarningsMetric = (typeof EARNINGS_METRICS)[number]

export interface Dividend {
  symbol: string
  date: string
  recordDate?: string | null
  paymentDate?: string | null
  declarationDate?: string | null
  adjDividend: number
  dividend: number
  yield: number
  frequency: string
}

export interface Earning {
  symbol: string
  date: string
  epsActual?: number | null
  epsEstimated?: number | null
  revenueActual?: number | null
  revenueEstimated?: number | null
  lastUpdated: string
}

export interface Split {
  symbol: string
  date: string
  numerator: number
  denominator: number
  splitType: string
}

export type CorporateAction = Dividend | Earning | Split

export const API_CORPORATE_ACTION_LIMIT = 5000
