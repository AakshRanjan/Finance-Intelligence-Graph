import type { Time, UTCTimestamp, WhitespaceData } from 'lightweight-charts'

import type { ChartInterval, Mode } from '@/modules/historical-data/api/types'
import type { ChartScale } from '@/modules/historical-data/chart/scale'

const DAY_MS = 24 * 60 * 60 * 1000
const MAX_WHITESPACE_SLOTS = 50_000

const INTERVAL_SECONDS: Record<ChartInterval, number> = {
  '1min': 60,
  '5min': 5 * 60,
  '15min': 15 * 60,
  '30min': 30 * 60,
  '1hour': 60 * 60,
  '4hour': 4 * 60 * 60,
}

export type TimeStep = { kind: 'day' } | { kind: 'seconds'; seconds: number }

export function intervalStep(
  mode: Mode,
  interval: ChartInterval,
): TimeStep {
  if (mode === 'eod') {
    return { kind: 'day' }
  }
  return { kind: 'seconds', seconds: INTERVAL_SECONDS[interval] }
}

export function barTime(date: string, mode: Mode): Time {
  if (mode === 'eod') {
    return date.slice(0, 10)
  }
  const parsed = Date.parse(date)
  const ms = Number.isFinite(parsed)
    ? parsed
    : Date.parse(`${date.slice(0, 10)}T00:00:00Z`)
  return Math.floor(ms / 1000) as UTCTimestamp
}

export function utcDay(date: string): string {
  return date.slice(0, 10)
}

function addUtcDay(isoDate: string): string {
  return new Date(Date.parse(`${isoDate}T00:00:00Z`) + DAY_MS)
    .toISOString()
    .slice(0, 10)
}

function nextTime(time: Time, step: TimeStep): Time {
  if (step.kind === 'day') {
    return addUtcDay(String(time))
  }
  return ((time as number) + step.seconds) as UTCTimestamp
}

function compareTime(left: Time, right: Time): number {
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right
  }
  return String(left).localeCompare(String(right))
}

function timeKey(time: Time): string {
  return String(time)
}

export function uniqueByTime<T extends { time: Time }>(points: T[]): T[] {
  const byTime = new Map<string, T>()
  for (const point of points) {
    byTime.set(timeKey(point.time), point)
  }
  return [...byTime.values()].sort((left, right) =>
    compareTime(left.time, right.time),
  )
}

export function withWhitespace<T extends { time: Time }>(
  points: T[],
  scale: ChartScale,
  step: TimeStep,
  range?: { from: Time; to: Time },
): Array<T | WhitespaceData> {
  if (scale !== 'calendar') {
    return points
  }
  const first = range?.from ?? points[0]?.time
  const last = range?.to ?? points[points.length - 1]?.time
  if (first === undefined || last === undefined) {
    return points
  }
  if (compareTime(first, last) > 0) {
    return points
  }

  const byTime = new Map<string, T>()
  for (const point of points) {
    byTime.set(timeKey(point.time), point)
  }

  const filled: Array<T | WhitespaceData> = []
  let cursor = first
  while (compareTime(cursor, last) <= 0) {
    if (filled.length >= MAX_WHITESPACE_SLOTS) {
      return points
    }
    const existing = byTime.get(timeKey(cursor))
    filled.push(existing ?? { time: cursor })
    byTime.delete(timeKey(cursor))
    cursor = nextTime(cursor, step)
  }

  if (byTime.size > 0) {
    const leftovers = [...byTime.values()]
    leftovers.sort((left, right) => compareTime(left.time, right.time))
    filled.push(...leftovers)
    filled.sort((left, right) => compareTime(left.time, right.time))
  }

  return filled
}
