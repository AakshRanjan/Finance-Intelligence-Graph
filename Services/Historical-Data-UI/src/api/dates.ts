import type { Mode } from './types'

function utcDateString(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function defaultRange(mode: Mode): { from: string; to: string } {
  const to = new Date()
  const from = new Date()
  if (mode === 'eod') {
    from.setUTCFullYear(from.getUTCFullYear() - 1)
  } else {
    from.setUTCDate(from.getUTCDate() - 5)
  }
  return { from: utcDateString(from), to: utcDateString(to) }
}

export function rangeQuery(mode: Mode, from: string, to: string): {
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
