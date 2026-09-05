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
