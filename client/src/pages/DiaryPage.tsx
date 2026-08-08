import { useEffect, useState, type FormEvent } from 'react'
import { CopyPlus, Pencil, Plus, Search, Trash2 } from 'lucide-react'
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
  updateLogEntry,
  logFood,
  createCustomFood,
  getProfile,
  defaultMealType,
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

  const [editingEntryId, setEditingEntryId] = useState<number | null>(null)
  const [editQuantity, setEditQuantity] = useState('')
  const [editNote, setEditNote] = useState('')
  const [editMealType, setEditMealType] = useState<MealType>('breakfast')

  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [quickCalories, setQuickCalories] = useState('')
  const [quickDescription, setQuickDescription] = useState('')
  const [quickMealType, setQuickMealType] = useState<MealType>(defaultMealType())
  const [quickAdding, setQuickAdding] = useState(false)

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

  const startEdit = (entry: LogEntry) => {
    setEditingEntryId(entry.id)
    setEditQuantity(entry.quantity_grams)
    setEditNote(entry.note ?? '')
    setEditMealType(entry.meal_type)
    setError(null)
  }

  const cancelEdit = () => setEditingEntryId(null)

  const confirmEdit = async (entry: LogEntry) => {
    const amount = Number(editQuantity)
    if (!amount || amount <= 0) return
    try {
      await updateLogEntry(entry.id, amount, editNote.trim() || undefined, editMealType)
      setEditingEntryId(null)
      refreshLog()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  // Quick Add creates a fresh one-off custom food per entry (servingSizeGrams
  // 100, calories = the entered amount) rather than reusing a shared row —
  // calories_per_100g is read at display time, so reusing one row across
  // different quick-add amounts would silently corrupt every past entry
  // pointing at it.
  const handleQuickAdd = async () => {
    const amount = Number(quickCalories)
    if (!amount || amount <= 0) return
    setQuickAdding(true)
    setError(null)
    try {
      const food = await createCustomFood({
        description: quickDescription.trim() || 'Quick add',
        servingSizeGrams: 100,
        calories: amount,
      })
      await logFood(food.id, 100, undefined, quickMealType)
      setQuickCalories('')
      setQuickDescription('')
      setQuickAddOpen(false)
      refreshLog()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setQuickAdding(false)
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

          {!restaurant && (
            <>
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">or</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              {quickAddOpen ? (
                <div className="space-y-3 rounded-md bg-accent p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      value={quickCalories}
                      onChange={(e) => setQuickCalories(e.target.value)}
                      placeholder="Calories"
                      className="w-28"
                      autoFocus
                    />
                    <select
                      value={quickMealType}
                      onChange={(e) => setQuickMealType(e.target.value as MealType)}
                      className="h-9 rounded-md border border-input bg-transparent px-2 text-sm text-card-foreground outline-none"
                    >
                      {MEAL_TYPES.map((mt) => (
                        <option key={mt} value={mt}>
                          {MEAL_TYPE_LABELS[mt]}
                        </option>
                      ))}
                    </select>
                    <Button size="sm" onClick={handleQuickAdd} disabled={quickAdding}>
                      {quickAdding ? 'Adding…' : 'Add'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setQuickAddOpen(false)}>
                      Cancel
                    </Button>
                  </div>
                  <Input
                    value={quickDescription}
                    onChange={(e) => setQuickDescription(e.target.value)}
                    placeholder="What was it? (optional)"
                  />
                </div>
              ) : (
                <Button type="button" variant="outline" className="w-full" onClick={() => setQuickAddOpen(true)}>
                  <Plus />
                  Quick add calories
                </Button>
              )}
            </>
          )}

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
                      <li key={entry.id} className="px-3 py-2.5">
                        <div className="flex items-center justify-between gap-3">
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
                            {editingEntryId === entry.id ? (
                              <Button size="sm" variant="ghost" onClick={cancelEdit}>
                                Cancel
                              </Button>
                            ) : (
                              <>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  aria-label="Edit entry"
                                  onClick={() => startEdit(entry)}
                                >
                                  <Pencil size={15} />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  aria-label="Remove entry"
                                  onClick={() => handleRemove(entry.id)}
                                >
                                  <Trash2 className="text-destructive" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>

                        {editingEntryId === entry.id && (
                          <div className="mt-3 space-y-3 rounded-md bg-accent p-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <Input
                                type="number"
                                min={0}
                                step="any"
                                value={editQuantity}
                                onChange={(e) => setEditQuantity(e.target.value)}
                                className="w-24"
                              />
                              <span className="text-xs text-muted-foreground">grams</span>
                              <select
                                value={editMealType}
                                onChange={(e) => setEditMealType(e.target.value as MealType)}
                                className="h-9 rounded-md border border-input bg-transparent px-2 text-sm text-card-foreground outline-none"
                              >
                                {MEAL_TYPES.map((mt) => (
                                  <option key={mt} value={mt}>
                                    {MEAL_TYPE_LABELS[mt]}
                                  </option>
                                ))}
                              </select>
                              <Button size="sm" onClick={() => confirmEdit(entry)}>
                                Save
                              </Button>
                            </div>
                            <Input
                              value={editNote}
                              onChange={(e) => setEditNote(e.target.value)}
                              placeholder="Add a note (optional)"
                            />
                          </div>
                        )}
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
