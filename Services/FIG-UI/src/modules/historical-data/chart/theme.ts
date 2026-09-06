import {
  ColorType,
  CrosshairMode,
  type ChartOptions,
  type DeepPartial,
} from 'lightweight-charts'

export const UP_COLOR = '#26a69a'
export const DOWN_COLOR = '#ef5350'
export const LINE_COLOR = '#5c6bc0'
export const MUTED_SERIES_COLOR = '#90a4ae'

export interface ChartTheme {
  background: string
  foreground: string
  border: string
  mutedForeground: string
  grid: string
  up: string
  down: string
}

function cssToRgba(color: string, fallback: string): string {
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  const ctx = canvas.getContext('2d')
  if (ctx === null) {
    return fallback
  }
  try {
    ctx.fillStyle = fallback
    ctx.fillStyle = color
    ctx.fillRect(0, 0, 1, 1)
    const pixel = ctx.getImageData(0, 0, 1, 1).data
    return `rgba(${pixel[0]}, ${pixel[1]}, ${pixel[2]}, ${pixel[3] / 255})`
  } catch {
    return fallback
  }
}

function resolveCssColor(variable: string, fallback: string): string {
  const probe = document.createElement('span')
  probe.style.color = `var(${variable})`
  probe.style.position = 'absolute'
  probe.style.visibility = 'hidden'
  document.documentElement.appendChild(probe)
  const resolved = getComputedStyle(probe).color
  probe.remove()
  return cssToRgba(resolved === '' ? fallback : resolved, fallback)
}

function withAlpha(color: string, alpha: number): string {
  const match = color.match(
    /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/,
  )
  if (match === null) {
    return color
  }
  return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${alpha})`
}

export function parseUnsupportedCssColor(
  color: string,
): [number, number, number, number] | null {
  if (
    !color.startsWith('oklch') &&
    !color.startsWith('oklab') &&
    !color.startsWith('lab(') &&
    !color.startsWith('lch(') &&
    !color.startsWith('color(')
  ) {
    return null
  }
  const converted = cssToRgba(color, '')
  const match = converted.match(
    /rgba\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/,
  )
  if (match === null) {
    return null
  }
  return [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
    Number(match[4]),
  ]
}

export function readChartTheme(): ChartTheme {
  const background = resolveCssColor('--background', '#ffffff')
  const foreground = resolveCssColor('--foreground', '#09090b')
  const border = resolveCssColor('--border', '#e4e4e7')
  const mutedForeground = resolveCssColor('--muted-foreground', '#71717a')
  return {
    background,
    foreground,
    border,
    mutedForeground,
    grid: withAlpha(border, 0.6),
    up: UP_COLOR,
    down: DOWN_COLOR,
  }
}

export function chartOptionsFromTheme(
  theme: ChartTheme,
): DeepPartial<ChartOptions> {
  return {
    layout: {
      background: { type: ColorType.Solid, color: theme.background },
      textColor: theme.mutedForeground,
      attributionLogo: true,
    },
    grid: {
      vertLines: { color: theme.grid },
      horzLines: { color: theme.grid },
    },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: {
        color: theme.mutedForeground,
        width: 1,
        labelBackgroundColor: theme.foreground,
      },
      horzLine: {
        color: theme.mutedForeground,
        width: 1,
        labelBackgroundColor: theme.foreground,
      },
    },
    rightPriceScale: {
      borderColor: theme.border,
    },
    timeScale: {
      borderColor: theme.border,
      rightOffset: 4,
    },
  }
}
