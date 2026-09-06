import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { ChartScale } from '@/modules/historical-data/chart/scale'

interface ScaleToggleProps {
  value: ChartScale
  onChange: (scale: ChartScale) => void
  labelId?: string
}

export function ScaleToggle({
  value,
  onChange,
  labelId = 'chart-scale-label',
}: ScaleToggleProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label id={labelId}>Scale</Label>
      <ToggleGroup
        value={[value]}
        onValueChange={(groupValue) => {
          const next = groupValue[0]
          if (next === 'session' || next === 'calendar') {
            onChange(next)
          }
        }}
        variant="outline"
        spacing={0}
        aria-labelledby={labelId}
      >
        <ToggleGroupItem value="session">Session</ToggleGroupItem>
        <ToggleGroupItem value="calendar">Calendar</ToggleGroupItem>
      </ToggleGroup>
    </div>
  )
}
