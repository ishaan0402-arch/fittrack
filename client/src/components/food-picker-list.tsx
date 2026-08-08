import { useState, type ReactNode } from 'react'
import { Check, Plus, SlidersHorizontal, Star, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/empty-state'
import {
  logFood,
  addFavoriteFood,
  removeFavoriteFood,
  defaultMealType,
  MEAL_TYPES,
  MEAL_TYPE_LABELS,
  type Food,
  type MealType,
} from '@/api'

const GRAMS_PER_OUNCE = 28.3495

type Unit = 'g' | 'oz'

function defaultQuantity(food: Food): number {
  if (food.last_quantity_grams) return Number(food.last_quantity_grams)
  if (food.serving_size_grams) return Number(food.serving_size_grams)
  return 100
}

// The expandable quantity/unit/note mini-form used to log a food, shared by
// the Diary's search results and the Foods page's recent-foods list. The
// primary action is a single tap that re-logs the last-used quantity (or
// serving size / 100g as a fallback) — "customize" is a secondary,
// deliberately smaller action for the less-common case of eating a
// different amount than usual.
export function FoodPickerList({
  foods,
  emptyMessage,
  emptyIcon,
  meta,
  onLogged,
  onFavoriteToggled,
}: {
  foods: Food[]
  emptyMessage?: string
  emptyIcon?: LucideIcon
  /** Secondary line under the food name — e.g. "165 kcal / 100g" or "· logged 5x". */
  meta?: (food: Food) => ReactNode
  onLogged: () => void
  /** Only needed if the caller wants favorite-star toggling — omit to hide the star entirely. */
  onFavoriteToggled?: () => void
}) {
  const [expandedFoodId, setExpandedFoodId] = useState<number | null>(null)
  const [quantity, setQuantity] = useState('100')
  const [unit, setUnit] = useState<Unit>('g')
  const [note, setNote] = useState('')
  const [mealType, setMealType] = useState<MealType>(defaultMealType())
  const [error, setError] = useState<string | null>(null)
  const [justLoggedId, setJustLoggedId] = useState<number | null>(null)
  const [togglingFavoriteId, setTogglingFavoriteId] = useState<number | null>(null)

  const startAdd = (food: Food) => {
    setExpandedFoodId(food.id)
    setQuantity(String(defaultQuantity(food)))
    setUnit('g')
    setNote('')
    setMealType(defaultMealType())
    setError(null)
  }

  const flashLogged = (foodId: number) => {
    setJustLoggedId(foodId)
    setTimeout(() => setJustLoggedId((current) => (current === foodId ? null : current)), 1500)
  }

  const quickLog = async (food: Food) => {
    setError(null)
    try {
      await logFood(food.id, defaultQuantity(food))
      flashLogged(food.id)
      onLogged()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const toggleFavorite = async (food: Food) => {
    setTogglingFavoriteId(food.id)
    setError(null)
    try {
      if (food.is_favorite) {
        await removeFavoriteFood(food.id)
      } else {
        await addFavoriteFood(food.id)
      }
      onFavoriteToggled?.()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setTogglingFavoriteId(null)
    }
  }

  const confirmAdd = async (food: Food) => {
    const amount = Number(quantity)
    if (!amount || amount <= 0) return
    const grams = unit === 'oz' ? amount * GRAMS_PER_OUNCE : amount
    try {
      await logFood(food.id, grams, note.trim() || undefined, mealType)
      setExpandedFoodId(null)
      flashLogged(food.id)
      onLogged()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  if (foods.length === 0) {
    return emptyIcon ? (
      <EmptyState icon={emptyIcon} message={emptyMessage ?? 'Nothing here yet.'} />
    ) : (
      <p className="text-sm text-muted-foreground">{emptyMessage ?? 'Nothing here yet.'}</p>
    )
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <ul className="divide-y divide-border rounded-md border">
        {foods.map((food) => (
          <li key={food.id} className="px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-card-foreground">{food.description}</p>
                <p className="text-xs text-muted-foreground">
                  {meta ? meta(food) : `${Math.round(Number(food.calories_per_100g))} kcal / 100g`}
                </p>
              </div>
              {expandedFoodId === food.id ? (
                <Button size="sm" variant="ghost" onClick={() => setExpandedFoodId(null)}>
                  Cancel
                </Button>
              ) : (
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    size="sm"
                    variant={justLoggedId === food.id ? 'secondary' : 'default'}
                    disabled={justLoggedId === food.id}
                    onClick={() => quickLog(food)}
                  >
                    {justLoggedId === food.id ? (
                      <>
                        <Check />
                        Logged
                      </>
                    ) : (
                      <>
                        <Plus />
                        Log {defaultQuantity(food)}g
                      </>
                    )}
                  </Button>
                  {food.is_favorite !== undefined && (
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={food.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
                      disabled={togglingFavoriteId === food.id}
                      onClick={() => toggleFavorite(food)}
                    >
                      <Star size={15} className={food.is_favorite ? 'fill-brand text-brand' : undefined} />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Customize quantity"
                    onClick={() => startAdd(food)}
                  >
                    <SlidersHorizontal size={15} />
                  </Button>
                </div>
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
                  <select
                    value={mealType}
                    onChange={(e) => setMealType(e.target.value as MealType)}
                    className="h-9 rounded-md border border-input bg-transparent px-2 text-sm text-card-foreground outline-none"
                  >
                    {MEAL_TYPES.map((mt) => (
                      <option key={mt} value={mt}>
                        {MEAL_TYPE_LABELS[mt]}
                      </option>
                    ))}
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
    </div>
  )
}
