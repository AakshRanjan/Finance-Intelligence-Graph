import type { Mode } from './types'

export const EOD_PRESETS = ['1M', '3M', '1Y', 'YTD'] as const
export const INTRADAY_PRESETS = ['1D', '5D', '1M'] as const

export type EodPreset = (typeof EOD_PRESETS)[number]
export type IntradayPreset = (typeof INTRADAY_PRESETS)[number]
export type RangePreset = EodPreset | IntradayPreset

function utcDateString(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function defaultRange(mode: Mode): { from: string; to: string } {
  return rangeFromPreset(mode === 'eod' ? '1Y' : '5D')
}

export function rangeFromPreset(preset: RangePreset): { from: string; to: string } {
  const to = new Date()
  const from = new Date()
  if (preset === '1D') {
    from.setUTCDate(from.getUTCDate() - 1)
  } else if (preset === '5D') {
    from.setUTCDate(from.getUTCDate() - 5)
  } else if (preset === '1M') {
    from.setUTCMonth(from.getUTCMonth() - 1)
  } else if (preset === '3M') {
    from.setUTCMonth(from.getUTCMonth() - 3)
  } else if (preset === '1Y') {
    from.setUTCFullYear(from.getUTCFullYear() - 1)
  } else {
    from.setUTCMonth(0, 1)
  }
  return { from: utcDateString(from), to: utcDateString(to) }
}

export function matchingPreset(
  mode: Mode,
  from: string,
  to: string,
): RangePreset | null {
  const presets = mode === 'eod' ? EOD_PRESETS : INTRADAY_PRESETS
  const today = utcDateString(new Date())
  if (to !== today) {
    return null
  }
  for (const preset of presets) {
    if (rangeFromPreset(preset).from === from) {
      return preset
    }
  }
  return null
}

export function rangeQuery(
  mode: Mode,
  from: string,
  to: string,
): {
  from: string
  to: string
} {
  if (mode === 'eod') {
    return { from, to }
  }
  return {
    from: `${from}T00:00:00Z`,
    to: `${to}T23:59:59Z`,
  }
}
