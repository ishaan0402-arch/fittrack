import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, ListChecks, Plus, Search, Trash2, UtensilsCrossed, X } from 'lucide-react'
import { AppLayout } from '@/components/app-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  searchFoods,
  getMealPlanRange,
  addMealPlanEntry,
  addMealToPlan,
  logMealPlanEntry,
  deleteMealPlanEntry,
  getGroceryList,
  getMeals,
  MEAL_TYPES,
  MEAL_TYPE_LABELS,
  type Food,
  type MealPlanEntry,
  type GroceryListItem,
  type Meal,
  type MealType,
} from '@/api'

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function startOfWeek(d: Date): Date {
  const copy = new Date(d)
  copy.setDate(copy.getDate() - copy.getDay())
  copy.setHours(0, 0, 0, 0)
  return copy
}

export function MealPlanPage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [entries, setEntries] = useState<MealPlanEntry[]>([])
  const [meals, setMeals] = useState<Meal[]>([])
  const [error, setError] = useState<string | null>(null)

  const [addTarget, setAddTarget] = useState<{ date: string; mealType: MealType } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Food[]>([])
  const [searching, setSearching] = useState(false)

  const [groceryList, setGroceryList] = useState<GroceryListItem[] | null>(null)
  const [checked, setChecked] = useState<Set<number>>(new Set())

  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart)
      d.setDate(d.getDate() + i)
      return d
    }),
    [weekStart]
  )
  const weekEndKey = toDateKey(weekDates[6])
  const weekStartKey = toDateKey(weekDates[0])

  const refresh = () => {
    getMealPlanRange(weekStartKey, weekEndKey)
      .then(setEntries)
      .catch((e) => setError((e as Error).message))
  }

  useEffect(refresh, [weekStartKey, weekEndKey])

  useEffect(() => {
    getMeals().then(setMeals).catch(() => {})
  }, [])

  useEffect(() => {
    setGroceryList(null)
    setChecked(new Set())
  }, [weekStartKey, weekEndKey])

  const entriesFor = (dateKey: string, mealType: MealType) =>
    entries.filter((e) => e.date === dateKey && e.meal_type === mealType)

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    try {
      setSearchResults(await searchFoods(searchQuery.trim()))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSearching(false)
    }
  }

  const handleAddFood = async (food: Food) => {
    if (!addTarget) return
    try {
      await addMealPlanEntry(addTarget.date, addTarget.mealType, food.id, 100)
      setAddTarget(null)
      setSearchQuery('')
      setSearchResults([])
      refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const handleAddSavedMeal = async (date: string, mealType: MealType, mealId: number) => {
    try {
      await addMealToPlan(date, mealType, mealId)
      refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const handleLog = async (id: number) => {
    try {
      await logMealPlanEntry(id)
      refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteMealPlanEntry(id)
      refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const handleGroceryList = async () => {
    try {
      setGroceryList(await getGroceryList(weekStartKey, weekEndKey))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const toggleChecked = (foodId: number) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(foodId)) next.delete(foodId)
      else next.add(foodId)
      return next
    })
  }

  return (
    <AppLayout
      title="Plan"
      description="Plan meals for the week ahead, then generate a grocery list."
      maxWidth="max-w-5xl"
    >
      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>
            {weekDates[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} –{' '}
            {weekDates[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              aria-label="Previous week"
              onClick={() => setWeekStart((d) => { const n = new Date(d); n.setDate(n.getDate() - 7); return n })}
            >
              <ChevronLeft />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Next week"
              onClick={() => setWeekStart((d) => { const n = new Date(d); n.setDate(n.getDate() + 7); return n })}
            >
              <ChevronRight />
            </Button>
            <Button size="sm" variant="outline" onClick={handleGroceryList}>
              <ListChecks size={15} />
              Grocery list
            </Button>
          </div>
        </CardHeader>
      </Card>

      {groceryList && (
        <Card>
          <CardHeader>
            <CardTitle>Grocery list</CardTitle>
            <CardDescription>Everything planned this week, combined.</CardDescription>
          </CardHeader>
          <CardContent>
            {groceryList.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing planned yet this week.</p>
            ) : (
              <ul className="space-y-1">
                {groceryList.map((item) => (
                  <li key={item.food_id}>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked.has(item.food_id)}
                        onChange={() => toggleChecked(item.food_id)}
                      />
                      <span className={checked.has(item.food_id) ? 'text-muted-foreground line-through' : 'text-card-foreground'}>
                        {item.description} — {Math.round(Number(item.total_quantity_grams))}g
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {weekDates.map((date) => {
        const dateKey = toDateKey(date)
        return (
          <Card key={dateKey}>
            <CardHeader>
              <CardTitle>
                {date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {MEAL_TYPES.map((mealType) => {
                const items = entriesFor(dateKey, mealType)
                const isAdding = addTarget?.date === dateKey && addTarget?.mealType === mealType
                return (
                  <div key={mealType} className="space-y-1.5">
                    <p className="label-quiet">{MEAL_TYPE_LABELS[mealType]}</p>
                    {items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5 text-sm">
                        <span className="truncate text-card-foreground">
                          {item.description} <span className="text-muted-foreground">({Math.round(Number(item.quantity_grams))}g, {Math.round(Number(item.calories))} kcal)</span>
                        </span>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button size="sm" variant="ghost" onClick={() => handleLog(item.id)}>
                            Log
                          </Button>
                          <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => handleDelete(item.id)}>
                            <Trash2 size={14} className="text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}

                    {isAdding ? (
                      <div className="space-y-2 rounded-md bg-accent p-2.5">
                        <div className="flex gap-2">
                          <Input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search a food"
                            className="flex-1"
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            autoFocus
                          />
                          <Button size="sm" onClick={handleSearch} disabled={searching}>
                            <Search size={14} />
                          </Button>
                          <Button size="icon" variant="ghost" aria-label="Cancel" onClick={() => { setAddTarget(null); setSearchResults([]); setSearchQuery('') }}>
                            <X size={14} />
                          </Button>
                        </div>
                        {searchResults.length > 0 && (
                          <ul className="max-h-40 space-y-1 overflow-y-auto">
                            {searchResults.map((food) => (
                              <li key={food.id}>
                                <button
                                  type="button"
                                  onClick={() => handleAddFood(food)}
                                  className="w-full rounded px-2 py-1 text-left text-sm text-card-foreground hover:bg-background"
                                >
                                  {food.description}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                        {meals.length > 0 && (
                          <select
                            defaultValue=""
                            onChange={(e) => {
                              if (e.target.value) handleAddSavedMeal(dateKey, mealType, Number(e.target.value))
                              e.target.value = ''
                              setAddTarget(null)
                            }}
                            className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs text-card-foreground outline-none"
                          >
                            <option value="" disabled>
                              Or add a saved meal…
                            </option>
                            {meals.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setAddTarget({ date: dateKey, mealType }); setSearchResults([]); setSearchQuery('') }}
                      >
                        <Plus size={14} />
                        Add
                      </Button>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )
      })}

      {meals.length === 0 && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <UtensilsCrossed size={14} />
          Save a meal on the Meals page to plan it in one tap.
        </p>
      )}
    </AppLayout>
  )
}
