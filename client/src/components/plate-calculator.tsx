import { useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

const PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25]
const BAR_OPTIONS_KG = [20, 15, 10, 7.5]

// Standard color coding used on most gym plates, purely visual.
const PLATE_COLOR: Record<number, string> = {
  25: 'bg-red-500',
  20: 'bg-sky-500',
  15: 'bg-amber-400',
  10: 'bg-emerald-500',
  5: 'bg-neutral-300',
  2.5: 'bg-neutral-400',
  1.25: 'bg-neutral-500',
}

function greedyPlates(perSideKg: number): { plate: number; count: number }[] {
  let remaining = perSideKg
  const result: { plate: number; count: number }[] = []
  for (const plate of PLATES_KG) {
    let count = 0
    // Small epsilon so float rounding (e.g. 0.1 + 0.2 wobble) doesn't skip a plate.
    while (remaining >= plate - 1e-6) {
      remaining -= plate
      count++
    }
    if (count > 0) result.push({ plate, count })
  }
  return result
}

export function PlateCalculator() {
  const [target, setTarget] = useState(60)
  const [bar, setBar] = useState(20)

  const perSide = Math.max(0, (target - bar) / 2)
  const plates = useMemo(() => greedyPlates(perSide), [perSide])
  const achieved = bar + 2 * plates.reduce((sum, p) => sum + p.plate * p.count, 0)
  const shortfall = target - achieved

  return (
    <Card>
      <CardHeader>
        <CardTitle>Plate calculator</CardTitle>
        <CardDescription>Figure out which plates to load per side for a target weight.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-card-foreground">Target weight (kg)</label>
            <Input
              type="number"
              min={0}
              step="any"
              value={target}
              onChange={(e) => setTarget(Number(e.target.value) || 0)}
              className="w-28"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-card-foreground">Bar weight (kg)</label>
            <select
              value={bar}
              onChange={(e) => setBar(Number(e.target.value))}
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm text-card-foreground outline-none"
            >
              {BAR_OPTIONS_KG.map((b) => (
                <option key={b} value={b}>
                  {b}kg
                </option>
              ))}
            </select>
          </div>
        </div>

        {perSide === 0 ? (
          <p className="text-sm text-muted-foreground">Target is at or below the bar — no plates needed.</p>
        ) : plates.length === 0 ? (
          <p className="text-sm text-muted-foreground">Not enough weight above the bar for a full plate.</p>
        ) : (
          <div className="space-y-2">
            <p className="label-quiet text-xs">Per side</p>
            <div className="flex flex-wrap items-center gap-2">
              {plates.map(({ plate, count }) => (
                <div key={plate} className="flex items-center gap-1.5 rounded-md border border-input px-2 py-1.5">
                  <span className={`size-3 rounded-full ${PLATE_COLOR[plate] ?? 'bg-neutral-400'}`} />
                  <span className="text-sm font-medium text-card-foreground">
                    {plate}kg × {count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {Math.abs(shortfall) > 1e-6 && (
          <p className="text-xs text-muted-foreground">
            Closest achievable with standard plates: {achieved}kg ({shortfall > 0 ? '−' : '+'}
            {Math.abs(shortfall).toFixed(2)}kg from target).
          </p>
        )}
      </CardContent>
    </Card>
  )
}
