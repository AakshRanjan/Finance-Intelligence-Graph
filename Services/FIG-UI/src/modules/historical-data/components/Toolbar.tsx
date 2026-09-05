import {
  EOD_PRESETS,
  INTRADAY_PRESETS,
  matchingPreset,
  type RangePreset,
} from '@/modules/historical-data/api/dates'
import {
  CHART_INTERVALS,
  type ChartInterval,
  type Mode,
  type SymbolInfo,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

interface ToolbarProps {
  mode: Mode
  symbol: string
  from: string
  to: string
  interval: ChartInterval
  catalog: SymbolInfo[]
  onModeChange: (mode: Mode) => void
  onSymbolChange: (symbol: string) => void
  onFromChange: (from: string) => void
  onToChange: (to: string) => void
  onIntervalChange: (interval: ChartInterval) => void
  onPreset: (preset: RangePreset) => void
}

export function Toolbar({
  mode,
  symbol,
  from,
  to,
  interval,
  catalog,
  onModeChange,
  onSymbolChange,
  onFromChange,
  onToChange,
  onIntervalChange,
  onPreset,
}: ToolbarProps) {
  const listed = catalog.find(
    (item) => item.symbol === symbol.trim().toUpperCase(),
  )
  const symbols = catalog.map((item) => item.symbol)
  const selectedSymbol = symbols.includes(symbol) ? symbol : null
  const presets = mode === 'eod' ? EOD_PRESETS : INTRADAY_PRESETS
  const activePreset = matchingPreset(mode, from, to)

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
            <Label id="bar-type-label">Bar type</Label>
            <ToggleGroup
              value={[mode]}
              onValueChange={(groupValue) => {
                const next = groupValue[0]
                if (next === 'eod' || next === 'intraday') {
                  onModeChange(next)
                }
              }}
              variant="outline"
              spacing={0}
              aria-labelledby="bar-type-label"
            >
              <ToggleGroupItem value="eod">EOD</ToggleGroupItem>
              <ToggleGroupItem value="intraday">Intraday</ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="flex min-w-36 flex-col gap-1.5">
            <Label htmlFor="symbol">Symbol</Label>
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
                id="symbol"
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

          {mode === 'intraday' ? (
            <div className="flex min-w-36 flex-col gap-1.5">
              <Label htmlFor="interval">Interval</Label>
              <Select
                value={interval}
                onValueChange={(value) => {
                  if (value !== null) {
                    onIntervalChange(value as ChartInterval)
                  }
                }}
              >
                <SelectTrigger id="interval" className="min-w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHART_INTERVALS.map((option) => {
                    const unavailable =
                      listed !== undefined &&
                      !listed.intraday_intervals.includes(option)
                    return (
                      <SelectItem
                        key={option}
                        value={option}
                        disabled={unavailable}
                      >
                        {option}
                        {unavailable ? ' (no data)' : ''}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label id="range-preset-label">Range</Label>
            <ToggleGroup
              value={activePreset === null ? [] : [activePreset]}
              onValueChange={(groupValue) => {
                const next = groupValue[0]
                if (next !== undefined) {
                  onPreset(next as RangePreset)
                }
              }}
              variant="outline"
              spacing={0}
              aria-labelledby="range-preset-label"
            >
              {presets.map((preset) => (
                <ToggleGroupItem key={preset} value={preset}>
                  {preset}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          <div className="flex min-w-36 flex-col gap-1.5">
            <Label htmlFor="from">From</Label>
            <Input
              id="from"
              type="date"
              value={from}
              onChange={(event) => onFromChange(event.target.value)}
              required
            />
          </div>

          <div className="flex min-w-36 flex-col gap-1.5">
            <Label htmlFor="to">To</Label>
            <Input
              id="to"
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
