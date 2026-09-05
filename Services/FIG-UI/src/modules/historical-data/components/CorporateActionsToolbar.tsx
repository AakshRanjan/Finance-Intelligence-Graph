import {
  CORPORATE_ACTION_PRESETS,
  matchingCorporateActionPreset,
  type CorporateActionPreset,
} from '@/modules/historical-data/api/dates'
import type {
  CorporateActionKind,
  EarningsMetric,
  SymbolInfo,
} from '@/modules/historical-data/api/types'
import { Card, CardContent } from '@/components/ui/card'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

interface CorporateActionsToolbarProps {
  kind: CorporateActionKind
  symbol: string
  from: string
  to: string
  catalog: SymbolInfo[]
  earningsMetric: EarningsMetric
  onKindChange: (kind: CorporateActionKind) => void
  onSymbolChange: (symbol: string) => void
  onFromChange: (from: string) => void
  onToChange: (to: string) => void
  onPreset: (preset: CorporateActionPreset) => void
  onEarningsMetricChange: (metric: EarningsMetric) => void
}

function isCorporateActionKind(value: string): value is CorporateActionKind {
  return value === 'dividends' || value === 'earnings' || value === 'splits'
}

function isEarningsMetric(value: string): value is EarningsMetric {
  return value === 'eps' || value === 'revenue'
}

export function CorporateActionsToolbar({
  kind,
  symbol,
  from,
  to,
  catalog,
  earningsMetric,
  onKindChange,
  onSymbolChange,
  onFromChange,
  onToChange,
  onPreset,
  onEarningsMetricChange,
}: CorporateActionsToolbarProps) {
  const symbols = catalog.map((item) => item.symbol)
  const selectedSymbol = symbols.includes(symbol) ? symbol : null
  const activePreset = matchingCorporateActionPreset(from, to)

  return (
    <Card size="sm">
      <CardContent>
        <form
          className="flex flex-wrap items-end gap-x-4 gap-y-3"
          onSubmit={(event) => {
            event.preventDefault()
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label id="action-kind-label">Type</Label>
            <ToggleGroup
              value={[kind]}
              onValueChange={(groupValue) => {
                const next = groupValue[0]
                if (next !== undefined && isCorporateActionKind(next)) {
                  onKindChange(next)
                }
              }}
              variant="outline"
              spacing={0}
              aria-labelledby="action-kind-label"
            >
              <ToggleGroupItem value="dividends">Dividends</ToggleGroupItem>
              <ToggleGroupItem value="earnings">Earnings</ToggleGroupItem>
              <ToggleGroupItem value="splits">Splits</ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="flex min-w-36 flex-col gap-1.5">
            <Label htmlFor="corporate-action-symbol">Symbol</Label>
            <Combobox
              items={symbols}
              value={selectedSymbol}
              onValueChange={(next) => {
                if (typeof next === 'string') {
                  onSymbolChange(next)
                }
              }}
              inputValue={symbol}
              onInputValueChange={(next) => {
                onSymbolChange(next)
              }}
            >
              <ComboboxInput
                id="corporate-action-symbol"
                placeholder="AAPL"
                autoCapitalize="characters"
                spellCheck={false}
                required
                className="min-w-36"
              />
              <ComboboxContent>
                <ComboboxEmpty>No matching symbols.</ComboboxEmpty>
                <ComboboxList>
                  {(item) => (
                    <ComboboxItem key={item} value={item}>
                      {item}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </div>

          {kind === 'earnings' ? (
            <div className="flex flex-col gap-1.5">
              <Label id="earnings-metric-label">Metric</Label>
              <ToggleGroup
                value={[earningsMetric]}
                onValueChange={(groupValue) => {
                  const next = groupValue[0]
                  if (next !== undefined && isEarningsMetric(next)) {
                    onEarningsMetricChange(next)
                  }
                }}
                variant="outline"
                spacing={0}
                aria-labelledby="earnings-metric-label"
              >
                <ToggleGroupItem value="eps">EPS</ToggleGroupItem>
                <ToggleGroupItem value="revenue">Revenue</ToggleGroupItem>
              </ToggleGroup>
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label id="corporate-action-range-label">Range</Label>
            <ToggleGroup
              value={activePreset === null ? [] : [activePreset]}
              onValueChange={(groupValue) => {
                const next = groupValue[0]
                if (next !== undefined) {
                  onPreset(next as CorporateActionPreset)
                }
              }}
              variant="outline"
              spacing={0}
              aria-labelledby="corporate-action-range-label"
            >
              {CORPORATE_ACTION_PRESETS.map((preset) => (
                <ToggleGroupItem key={preset} value={preset}>
                  {preset}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          <div className="flex min-w-36 flex-col gap-1.5">
            <Label htmlFor="corporate-action-from">From</Label>
            <Input
              id="corporate-action-from"
              type="date"
              value={from}
              onChange={(event) => onFromChange(event.target.value)}
              required
            />
          </div>

          <div className="flex min-w-36 flex-col gap-1.5">
            <Label htmlFor="corporate-action-to">To</Label>
            <Input
              id="corporate-action-to"
              type="date"
              value={to}
              onChange={(event) => onToChange(event.target.value)}
              required
            />
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
