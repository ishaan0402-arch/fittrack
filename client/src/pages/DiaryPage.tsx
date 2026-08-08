import { useEffect, useState, type FormEvent } from 'react'
import { CopyPlus, Search, Trash2 } from 'lucide-react'
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
  getTodayLog,
  getLogForDate,
  deleteLogEntry,
  logFood,
  getProfile,
  MEAL_TYPES,
  MEAL_TYPE_LABELS,
  type Food,
  type DayTotals,
  type LogEntry,
  type NutrientTotal,
  type Profile,
  type MealType,
} from '@/api'
import { MeterRow } from '@/components/stats'
import { CalorieGauge } from '@/components/calorie-gauge'
import { NutritionDetail } from '@/components/nutrition-detail'
import { FoodPickerList } from '@/components/food-picker-list'
import { RestaurantPicker } from '@/components/restaurant-picker'
import { WaterTracker } from '@/components/water-tracker'
import { AppLayout } from '@/components/app-layout'

function yesterdayKey(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function DiaryPage() {
  const [profile, setProfile] = useState<Profile | null>(null)

  const [restaurant, setRestaurant] = useState<string | null>(null)
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
  const [copying, setCopying] = useState(false)

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
      .then(setProfile)
      .catch((e) => setError((e as Error).message))
  }, [])

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    setSearched(true)
    setError(null)
    try {
      setResults(await searchFoods(query, restaurant ?? undefined))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSearching(false)
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

  const handleCopyYesterday = async () => {
    setCopying(true)
    setError(null)
    try {
      const yesterday = await getLogForDate(yesterdayKey())
      if (yesterday.entries.length === 0) {
        setError("Nothing was logged yesterday.")
        return
      }
      for (const entry of yesterday.entries) {
        await logFood(entry.food_id, Number(entry.quantity_grams), entry.note ?? undefined, entry.meal_type)
      }
      refreshLog()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCopying(false)
    }
  }

  const calorieTarget = profile?.calorieTarget ?? 0
  const macroTargets = profile?.macroTargets ?? { protein: 0, carbs: 0, fat: 0 }

  return (
    <AppLayout title="Diary" description="Log what you eat and track your calories.">
      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Water</CardTitle>
        </CardHeader>
        <CardContent>
          <WaterTracker />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>Today</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-4">
          <CalorieGauge consumed={totals.calories} target={calorieTarget} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Targets</CardTitle>
          <CardDescription>
            Calorie and macro targets, adjusted for your goal.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <MeterRow label="Energy" consumed={totals.calories} target={calorieTarget} unit=" kcal" />
          <MeterRow label="Protein" consumed={totals.protein} target={macroTargets.protein} unit="g" />
          <MeterRow label="Carbs" consumed={totals.carbs} target={macroTargets.carbs} unit="g" />
          <MeterRow label="Fat" consumed={totals.fat} target={macroTargets.fat} unit="g" />
        </CardContent>
      </Card>

      <Card className={restaurant ? 'border-brand/40' : undefined}>
        <CardHeader>
          <CardTitle>{restaurant ? `${restaurant} Menu` : 'Add a food'}</CardTitle>
          <CardDescription>
            {restaurant
              ? `Searching ${restaurant}'s published menu nutrition`
              : 'Search for something you ate — or pick a restaurant to search its menu'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!restaurant && (
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Dining out?</p>
          )}
          <RestaurantPicker value={restaurant} onChange={setRestaurant} />

          {!restaurant && (
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">or search any food</span>
              <div className="h-px flex-1 bg-border" />
            </div>
          )}

          <form onSubmit={handleSearch} className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={restaurant ? `Search ${restaurant}'s menu` : 'Search a food, e.g. banana'}
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
            <FoodPickerList
              foods={results}
              meta={(food) => {
                const calories = Math.round(Number(food.calories_per_100g))
                return food.restaurant_name
                  ? `${calories} kcal / 100g · ${food.restaurant_name}`
                  : `${calories} kcal / 100g`
              }}
              onLogged={refreshLog}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Today's log</CardTitle>
          <Button size="sm" variant="outline" onClick={handleCopyYesterday} disabled={copying}>
            <CopyPlus />
            {copying ? 'Copying…' : 'Copy yesterday'}
          </Button>
        </CardHeader>
        <CardContent className="space-y-5">
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing logged yet.</p>
          ) : (
            MEAL_TYPES.map((mealType) => {
              const group = entries.filter((entry) => entry.meal_type === mealType)
              if (group.length === 0) return null
              const subtotal = group.reduce((sum, entry) => sum + Number(entry.calories), 0)

              return (
                <div key={mealType}>
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <p className="label-quiet">{MEAL_TYPE_LABELS[mealType]}</p>
                    <p className="text-xs text-muted-foreground">{Math.round(subtotal)} kcal</p>
                  </div>
                  <ul className="divide-y divide-border rounded-md border">
                    {group.map((entry) => (
                      <li key={entry.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
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
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      <NutritionDetail nutrients={nutrients} />
    </AppLayout>
  )
}
