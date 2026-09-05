import { CandlestickChart, ChartLine } from 'lucide-react'

import { HistoricalDataPage } from '@/modules/historical-data/HistoricalDataPage'
import type { FigModule } from '@/modules/types'

export const historicalDataModule: FigModule = {
  id: 'historical-data',
  title: 'Historical Data',
  description: 'OHLCV bars from TimescaleDB via the Historical Data API.',
  path: '/historical-data',
  icon: CandlestickChart,
  children: [
    {
      id: 'charts',
      title: 'Charts',
      description: 'Price charts and OHLCV bars.',
      path: 'charts',
      icon: ChartLine,
      Component: HistoricalDataPage,
    },
  ],
}
