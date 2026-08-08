import type { NutrientTotal } from '@/api'
import {
  NUTRIENT_DEFS,
  NUTRIENT_GROUP_LABELS,
  NUTRIENT_GROUP_ORDER,
  HEADLINE_NUTRIENT_IDS,
} from '@/lib/nutrients'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { RingStat, MeterRow } from '@/components/stats'

const RING_COLORS = ['var(--ring-consumed)', 'var(--ring-expenditure)', 'var(--ring-remaining)']

export function NutritionDetail({ nutrients }: { nutrients: NutrientTotal[] }) {
  const byId = new Map(nutrients.map((n) => [n.nutrient_id, Number(n.amount)]))

  const headline = HEADLINE_NUTRIENT_IDS.map((id) =>
    NUTRIENT_DEFS.find((d) => d.id === id)
  ).filter((d): d is (typeof NUTRIENT_DEFS)[number] => !!d)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nutrition detail</CardTitle>
        <CardDescription>
          Full breakdown for today, against standard FDA daily values
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="flex flex-wrap justify-around gap-4">
          {headline.map((def, i) => (
            <RingStat
              key={def.id}
              size={72}
              value={byId.get(def.id) ?? 0}
              max={def.dv ?? 1}
              label={def.label}
              unit={def.unit}
              color={RING_COLORS[i % RING_COLORS.length]}
            />
          ))}
        </div>

        <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
          {NUTRIENT_GROUP_ORDER.map((group) => (
            <div key={group} className="space-y-3">
              <h3 className="text-sm font-semibold text-card-foreground">
                {NUTRIENT_GROUP_LABELS[group]}
              </h3>
              <div className="space-y-3">
                {NUTRIENT_DEFS.filter((d) => d.group === group).map((def) => (
                  <MeterRow
                    key={def.id}
                    label={def.label}
                    consumed={byId.get(def.id) ?? 0}
                    target={def.dv}
                    unit={` ${def.unit}`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
