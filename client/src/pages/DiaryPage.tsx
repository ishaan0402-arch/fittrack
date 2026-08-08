import { useEffect, useState, type FormEvent } from 'react'
import { Plus, Search, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  searchFoods,
  logFood,
  getTodayLog,
  deleteLogEntry,
  getProfile,
  type Food,
  type DayTotals,
  type LogEntry,
  type NutrientTotal,
} from '@/api'
import { RingStat, MeterRow } from '@/components/stats'
import { NutritionDetail } from '@/components/nutrition-detail'
import { AppLayout } from '@/components/app-layout'

// Placeholder until macro goals are configurable — Energy now comes from the
// user's real Mifflin-St Jeor expenditure (see /api/profile), not a guess.
const MACRO_TARGETS = { protein: 110, carbs: 200, fat: 60 }

const GRAMS_PER_OUNCE = 28.3495

type Unit = 'g' | 'oz'

export function DiaryPage() {
  const [expenditure, setExpenditure] = useState<number | null>(null)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Food[]>([])
  const [searched, setSearched] = useState(false)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [entries, setEntries] = useState<LogEntry[]>([])
  const [totals, setTotals] = useState<DayTotals>({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  })
  const [nutrients, setNutrients] = useState<NutrientTotal[]>([])

  // The one search-result row currently expanded into its quantity/unit/note form.
  const [expandedFoodId, setExpandedFoodId] = useState<number | null>(null)
  const [quantity, setQuantity] = useState('100')
  const [unit, setUnit] = useState<Unit>('g')
  const [note, setNote] = useState('')

  const refreshLog = () => {
    getTodayLog()
      .then((log) => {
        setEntries(log.entries)
        setTotals(log.totals)
        setNutrients(log.nutrients)
      })
      .catch((e) => setError((e as Error).message))
  }

  useEffect(refreshLog, [])

  useEffect(() => {
    getProfile()
      .then((profile) => setExpenditure(profile?.expenditure ?? null))
      .catch((e) => setError((e as Error).message))
  }, [])

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    setSearched(true)
    setError(null)
    setExpandedFoodId(null)
    try {
      setResults(await searchFoods(query))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSearching(false)
    }
  }

  const startAdd = (food: Food) => {
    setExpandedFoodId(food.id)
    setQuantity('100')
    setUnit('g')
    setNote('')
  }

  const confirmAdd = async (food: Food) => {
    const amount = Number(quantity)
    if (!amount || amount <= 0) return
    const grams = unit === 'oz' ? amount * GRAMS_PER_OUNCE : amount
    try {
      await logFood(food.id, grams, note.trim() || undefined)
      setExpandedFoodId(null)
      refreshLog()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const handleRemove = async (id: number) => {
    try {
      await deleteLogEntry(id)
      refreshLog()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const calorieTarget = expenditure ?? 0
  const remaining = calorieTarget - totals.calories

  return (
    <AppLayout title="Diary" description="Log what you eat and track your calories.">
      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardDescription>Today</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap justify-around gap-6">
          <RingStat
            value={totals.calories}
            max={calorieTarget || 1}
            label="Consumed"
            unit="kcal"
            color="var(--ring-consumed)"
          />
          <RingStat
            value={calorieTarget}
            max={calorieTarget || 1}
            label="Expenditure"
            unit="kcal"
            color="var(--ring-expenditure)"
          />
          <RingStat
            value={Math.max(remaining, 0)}
            max={calorieTarget || 1}
            label="Remaining"
            unit="kcal"
            color="var(--ring-remaining)"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Targets</CardTitle>
          <CardDescription>
            Energy target is your estimated maintenance calories. Protein/Carbs/Fat are
            placeholders until macro goals are configurable.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <MeterRow label="Energy" consumed={totals.calories} target={calorieTarget} unit=" kcal" />
          <MeterRow label="Protein" consumed={totals.protein} target={MACRO_TARGETS.protein} unit="g" />
          <MeterRow label="Carbs" consumed={totals.carbs} target={MACRO_TARGETS.carbs} unit="g" />
          <MeterRow label="Fat" consumed={totals.fat} target={MACRO_TARGETS.fat} unit="g" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add a food</CardTitle>
          <CardDescription>Search for something you ate</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a food, e.g. banana"
            />
            <Button type="submit" disabled={searching}>
              <Search />
              {searching ? 'Searching…' : 'Search'}
            </Button>
          </form>

          {searched && !searching && results.length === 0 && (
            <p className="text-sm text-muted-foreground">No foods matched.</p>
          )}

          {results.length > 0 && (
            <ul className="divide-y divide-border rounded-md border">
              {results.map((food) => (
                <li key={food.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-card-foreground">
                        {food.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {food.calories_per_100g} kcal / 100g
                      </p>
                    </div>
                    {expandedFoodId === food.id ? (
                      <Button size="sm" variant="ghost" onClick={() => setExpandedFoodId(null)}>
                        Cancel
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => startAdd(food)}>
                        <Plus />
                        Add
                      </Button>
                    )}
                  </div>

                  {expandedFoodId === food.id && (
                    <div className="mt-3 space-y-3 rounded-md bg-accent p-3">
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          step="any"
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                          className="w-24"
                        />
                        <select
                          value={unit}
                          onChange={(e) => setUnit(e.target.value as Unit)}
                          className="h-9 rounded-md border border-input bg-transparent px-2 text-sm text-card-foreground outline-none"
                        >
                          <option value="g">grams (g)</option>
                          <option value="oz">ounces (oz)</option>
                        </select>
                        <Button size="sm" onClick={() => confirmAdd(food)}>
                          Log it
                        </Button>
                      </div>
                      <Input
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Add a note (optional)"
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Today's log</CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing logged yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {entries.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-card-foreground">{entry.description}</p>
                    {entry.note && (
                      <p className="truncate text-xs text-muted-foreground">{entry.note}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-sm font-medium tabular-nums text-card-foreground">
                      {entry.calories} kcal
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Remove entry"
                      onClick={() => handleRemove(entry.id)}
                    >
                      <Trash2 className="text-destructive" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <NutritionDetail nutrients={nutrients} />
    </AppLayout>
  )
}
