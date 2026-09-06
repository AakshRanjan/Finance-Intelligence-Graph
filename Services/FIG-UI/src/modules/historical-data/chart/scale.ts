export const CHART_SCALES = ['session', 'calendar'] as const

export type ChartScale = (typeof CHART_SCALES)[number]
