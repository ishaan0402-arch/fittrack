import { useEffect, useState, type FormEvent } from 'react'
import { Apple, ChefHat, Plus, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AppLayout } from '@/components/app-layout'
import { FoodPickerList } from '@/components/food-picker-list'
import {
  getRecentFoods,
  getCustomFoods,
  getFavoriteFoods,
  createCustomFood,
  type Food,
  type RecentFood,
} from '@/api'

export function FoodsPage() {
  const [recent, setRecent] = useState<RecentFood[]>([])
  const [custom, setCustom] = useState<Food[]>([])
  const [favorites, setFavorites] = useState<Food[]>([])
  const [error, setError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [description, setDescription] = useState('')
  const [servingSize, setServingSize] = useState('100')
  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const refreshRecent = () => {
    getRecentFoods()
      .then(setRecent)
      .catch((e) => setError((e as Error).message))
  }

  const refreshCustom = () => {
    getCustomFoods()
      .then(setCustom)
      .catch((e) => setError((e as Error).message))
  }

  const refreshFavorites = () => {
    getFavoriteFoods()
      .then(setFavorites)
      .catch((e) => setError((e as Error).message))
  }

  // A favorite toggled from any of the three lists below should be reflected
  // in all three (e.g. starring a Recent food should also populate Favorites,
  // and un-starring a Favorite should update its is_favorite flag if it's
  // also shown under Recent or Custom).
  const refreshAll = () => {
    refreshRecent()
    refreshCustom()
    refreshFavorites()
  }

  useEffect(refreshAll, [])

  const resetForm = () => {
    setDescription('')
    setServingSize('100')
    setCalories('')
    setProtein('')
    setCarbs('')
    setFat('')
    setFormError(null)
  }

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    const servingSizeGrams = Number(servingSize)
    const caloriesValue = Number(calories)
    if (!description.trim()) {
      setFormError('Give the food a name.')
      return
    }
    if (!servingSizeGrams || servingSizeGrams <= 0) {
      setFormError('Serving size must be a positive number of grams.')
      return
    }
    if (!calories || caloriesValue < 0) {
      setFormError('Enter the calories for that serving.')
      return
    }

    setSaving(true)
    try {
      await createCustomFood({
        description: description.trim(),
        servingSizeGrams,
        calories: caloriesValue,
        protein: protein ? Number(protein) : undefined,
        carbs: carbs ? Number(carbs) : undefined,
        fat: fat ? Number(fat) : undefined,
      })
      resetForm()
      setShowForm(false)
      refreshCustom()
    } catch (e) {
      setFormError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppLayout title="Foods" description="Foods you've logged before — add them again in one tap.">
      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Your custom foods</CardTitle>
            <CardDescription>
              Foods that aren't in USDA's database — enter your own calories and macros.
            </CardDescription>
          </div>
          <Button size="sm" variant={showForm ? 'ghost' : 'outline'} onClick={() => setShowForm((v) => !v)}>
            {showForm ? (
              'Cancel'
            ) : (
              <>
                <Plus />
                New food
              </>
            )}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {showForm && (
            <form onSubmit={handleCreate} className="space-y-3 rounded-md bg-accent p-4">
              {formError && <p className="text-sm text-destructive">{formError}</p>}
              <div>
                <label className="mb-1 block text-xs font-medium text-card-foreground">Name</label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Mom's lasagna"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-card-foreground">
                    Serving size (g)
                  </label>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={servingSize}
                    onChange={(e) => setServingSize(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-card-foreground">
                    Calories per serving
                  </label>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={calories}
                    onChange={(e) => setCalories(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-card-foreground">
                    Protein (g)
                  </label>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={protein}
                    onChange={(e) => setProtein(e.target.value)}
                    placeholder="optional"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-card-foreground">Carbs (g)</label>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={carbs}
                    onChange={(e) => setCarbs(e.target.value)}
                    placeholder="optional"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-card-foreground">Fat (g)</label>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={fat}
                    onChange={(e) => setFat(e.target.value)}
                    placeholder="optional"
                  />
                </div>
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save food'}
              </Button>
            </form>
          )}

          <FoodPickerList
            foods={custom}
            emptyMessage="Not in the database? Make it yourself."
            emptyIcon={ChefHat}
            meta={(food) => {
              const servingSize = food.serving_size_grams ? Number(food.serving_size_grams) : 100
              const calories = Math.round((Number(food.calories_per_100g) * servingSize) / 100)
              return `${calories} kcal / ${servingSize}g serving`
            }}
            onLogged={refreshAll}
            onFavoriteToggled={refreshAll}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Favorites</CardTitle>
          <CardDescription>Foods you've starred — tap the star on any food to add or remove one.</CardDescription>
        </CardHeader>
        <CardContent>
          <FoodPickerList
            foods={favorites}
            emptyMessage="Star a food below (or in the Diary) to pin it here."
            emptyIcon={Star}
            meta={(food) => `${Math.round(Number(food.calories_per_100g))} kcal / 100g`}
            onLogged={refreshAll}
            onFavoriteToggled={refreshAll}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent</CardTitle>
          <CardDescription>Your most recently logged foods, newest first</CardDescription>
        </CardHeader>
        <CardContent>
          <FoodPickerList
            foods={recent}
            emptyMessage="Log it once — it'll be here next time."
            emptyIcon={Apple}
            meta={(food) => {
              const r = food as RecentFood
              const times = Number(r.times_logged)
              return `${Math.round(Number(food.calories_per_100g))} kcal / 100g · logged ${times}×`
            }}
            onLogged={refreshAll}
            onFavoriteToggled={refreshAll}
          />
        </CardContent>
      </Card>
    </AppLayout>
  )
}
