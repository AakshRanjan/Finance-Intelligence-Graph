import { CandlestickChart, ChartLine, Landmark } from 'lucide-react'

import { CorporateActionsPage } from '@/modules/historical-data/CorporateActionsPage'
import { HistoricalDataPage } from '@/modules/historical-data/HistoricalDataPage'
import type { FigModule } from '@/modules/types'

export const historicalDataModule: FigModule = {
  id: 'historical-data',
  title: 'Historical Data',
  description:
    'OHLCV bars and corporate actions from TimescaleDB via the Historical Data API.',
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
    {
      id: 'corporate-actions',
      title: 'Corporate Actions',
      description: 'Dividends, earnings, and splits.',
      path: 'corporate-actions',
      icon: Landmark,
      Component: CorporateActionsPage,
    },
  ],
}
