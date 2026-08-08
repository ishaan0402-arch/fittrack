import { useEffect, useState, type FormEvent } from 'react'
import { ChefHat, Plus, Search, Trash2, UtensilsCrossed } from 'lucide-react'
import { EmptyState } from '@/components/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AppLayout } from '@/components/app-layout'
import {
  searchFoods,
  getCustomFoods,
  getMeals,
  createMeal,
  deleteMeal,
  logMeal,
  getRecipes,
  createRecipe,
  deleteRecipe,
  logFood,
  type Food,
  type Meal,
  type Recipe,
} from '@/api'

interface DraftItem {
  foodId: number
  description: string
  caloriesPer100g: number
  quantityGrams: number
}

export function MealsPage() {
  const [meals, setMeals] = useState<Meal[]>([])
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [loggedMealId, setLoggedMealId] = useState<number | null>(null)

  const [showBuilder, setShowBuilder] = useState(false)
  const [mealName, setMealName] = useState('')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Food[]>([])
  const [searching, setSearching] = useState(false)
  const [items, setItems] = useState<DraftItem[]>([])
  const [saving, setSaving] = useState(false)
  const [builderError, setBuilderError] = useState<string | null>(null)

  const refreshMeals = () => {
    getMeals()
      .then(setMeals)
      .catch((e) => setError((e as Error).message))
  }

  useEffect(refreshMeals, [])

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    setBuilderError(null)
    try {
      const [usdaResults, customFoods] = await Promise.all([searchFoods(query), getCustomFoods()])
      const matchingCustom = customFoods.filter((f) =>
        f.description.toLowerCase().includes(query.trim().toLowerCase())
      )
      setResults([...matchingCustom, ...usdaResults])
    } catch (e) {
      setBuilderError((e as Error).message)
    } finally {
      setSearching(false)
    }
  }

  const addItem = (food: Food) => {
    const quantityGrams = food.serving_size_grams ? Number(food.serving_size_grams) : 100
    setItems((prev) => [
      ...prev,
      {
        foodId: food.id,
        description: food.description,
        caloriesPer100g: Number(food.calories_per_100g),
        quantityGrams,
      },
    ])
  }

  const updateQuantity = (index: number, quantityGrams: number) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, quantityGrams } : item)))
  }

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  const resetBuilder = () => {
    setMealName('')
    setQuery('')
    setResults([])
    setItems([])
    setBuilderError(null)
  }

  const totalCalories = items.reduce(
    (sum, item) => sum + (item.caloriesPer100g * item.quantityGrams) / 100,
    0
  )

  const handleSaveMeal = async () => {
    setBuilderError(null)
    if (!mealName.trim()) {
      setBuilderError('Give the meal a name.')
      return
    }
    if (items.length === 0) {
      setBuilderError('Add at least one food.')
      return
    }
    setSaving(true)
    try {
      await createMeal(
        mealName.trim(),
        items.map((item) => ({ foodId: item.foodId, quantityGrams: item.quantityGrams }))
      )
      resetBuilder()
      setShowBuilder(false)
      refreshMeals()
    } catch (e) {
      setBuilderError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleLog = async (id: number) => {
    setActionError(null)
    try {
      await logMeal(id)
      setLoggedMealId(id)
      setTimeout(() => setLoggedMealId((current) => (current === id ? null : current)), 2000)
    } catch (e) {
      setActionError((e as Error).message)
    }
  }

  const handleDelete = async (id: number) => {
    setActionError(null)
    try {
      await deleteMeal(id)
      refreshMeals()
    } catch (e) {
      setActionError((e as Error).message)
    }
  }

  // --- Recipes: same builder pattern as meals, but collapses into ONE
  // loggable food (servings-aware) instead of re-logging every ingredient. ---
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loggedRecipeId, setLoggedRecipeId] = useState<number | null>(null)
  const [showRecipeBuilder, setShowRecipeBuilder] = useState(false)
  const [recipeName, setRecipeName] = useState('')
  const [servings, setServings] = useState('4')
  const [recipeQuery, setRecipeQuery] = useState('')
  const [recipeResults, setRecipeResults] = useState<Food[]>([])
  const [recipeSearching, setRecipeSearching] = useState(false)
  const [ingredients, setIngredients] = useState<DraftItem[]>([])
  const [recipeSaving, setRecipeSaving] = useState(false)
  const [recipeBuilderError, setRecipeBuilderError] = useState<string | null>(null)

  const refreshRecipes = () => {
    getRecipes()
      .then(setRecipes)
      .catch((e) => setError((e as Error).message))
  }

  useEffect(refreshRecipes, [])

  const handleRecipeSearch = async (e: FormEvent) => {
    e.preventDefault()
    if (!recipeQuery.trim()) return
    setRecipeSearching(true)
    setRecipeBuilderError(null)
    try {
      const [usdaResults, customFoods] = await Promise.all([searchFoods(recipeQuery), getCustomFoods()])
      const matchingCustom = customFoods.filter((f) =>
        f.description.toLowerCase().includes(recipeQuery.trim().toLowerCase())
      )
      setRecipeResults([...matchingCustom, ...usdaResults])
    } catch (e) {
      setRecipeBuilderError((e as Error).message)
    } finally {
      setRecipeSearching(false)
    }
  }

  const addIngredient = (food: Food) => {
    const quantityGrams = food.serving_size_grams ? Number(food.serving_size_grams) : 100
    setIngredients((prev) => [
      ...prev,
      { foodId: food.id, description: food.description, caloriesPer100g: Number(food.calories_per_100g), quantityGrams },
    ])
  }

  const updateIngredientQuantity = (index: number, quantityGrams: number) => {
    setIngredients((prev) => prev.map((item, i) => (i === index ? { ...item, quantityGrams } : item)))
  }

  const removeIngredient = (index: number) => {
    setIngredients((prev) => prev.filter((_, i) => i !== index))
  }

  const resetRecipeBuilder = () => {
    setRecipeName('')
    setServings('4')
    setRecipeQuery('')
    setRecipeResults([])
    setIngredients([])
    setRecipeBuilderError(null)
  }

  const totalRecipeCalories = ingredients.reduce(
    (sum, item) => sum + (item.caloriesPer100g * item.quantityGrams) / 100,
    0
  )
  const servingsNum = Number(servings) || 1

  const handleSaveRecipe = async () => {
    setRecipeBuilderError(null)
    if (!recipeName.trim()) {
      setRecipeBuilderError('Give the recipe a name.')
      return
    }
    if (!servingsNum || servingsNum <= 0) {
      setRecipeBuilderError('Servings must be a positive number.')
      return
    }
    if (ingredients.length === 0) {
      setRecipeBuilderError('Add at least one ingredient.')
      return
    }
    setRecipeSaving(true)
    try {
      await createRecipe(
        recipeName.trim(),
        servingsNum,
        ingredients.map((item) => ({ foodId: item.foodId, quantityGrams: item.quantityGrams }))
      )
      resetRecipeBuilder()
      setShowRecipeBuilder(false)
      refreshRecipes()
    } catch (e) {
      setRecipeBuilderError((e as Error).message)
    } finally {
      setRecipeSaving(false)
    }
  }

  const handleLogRecipe = async (recipe: Recipe) => {
    setActionError(null)
    try {
      const quantity = recipe.serving_size_grams ? Number(recipe.serving_size_grams) : 100
      await logFood(recipe.id, quantity)
      setLoggedRecipeId(recipe.recipe_id)
      setTimeout(() => setLoggedRecipeId((current) => (current === recipe.recipe_id ? null : current)), 2000)
    } catch (e) {
      setActionError((e as Error).message)
    }
  }

  const handleDeleteRecipe = async (recipeId: number) => {
    setActionError(null)
    try {
      await deleteRecipe(recipeId)
      refreshRecipes()
    } catch (e) {
      setActionError((e as Error).message)
    }
  }

  return (
    <AppLayout title="Meals" description="Save combinations of foods you eat often, and log them in one tap.">
      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Build a meal</CardTitle>
            <CardDescription>Combine foods you already log together into one saved meal.</CardDescription>
          </div>
          <Button
            size="sm"
            variant={showBuilder ? 'ghost' : 'outline'}
            onClick={() => {
              setShowBuilder((v) => !v)
              if (showBuilder) resetBuilder()
            }}
          >
            {showBuilder ? (
              'Cancel'
            ) : (
              <>
                <Plus />
                New meal
              </>
            )}
          </Button>
        </CardHeader>
        {showBuilder && (
          <CardContent className="space-y-4">
            {builderError && <p className="text-sm text-destructive">{builderError}</p>}

            <div>
              <label className="mb-1 block text-xs font-medium text-card-foreground">Meal name</label>
              <Input
                value={mealName}
                onChange={(e) => setMealName(e.target.value)}
                placeholder="e.g. Breakfast smoothie"
              />
            </div>

            <form onSubmit={handleSearch} className="flex gap-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search a food to add"
              />
              <Button type="submit" disabled={searching}>
                <Search />
                {searching ? 'Searching…' : 'Search'}
              </Button>
            </form>

            {results.length > 0 && (
              <ul className="divide-y divide-border rounded-md border">
                {results.map((food) => (
                  <li key={food.id} className="flex items-center justify-between gap-4 px-4 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-card-foreground">{food.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {Math.round(Number(food.calories_per_100g))} kcal / 100g
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => addItem(food)}>
                      <Plus />
                      Add
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            {items.length > 0 && (
              <div className="space-y-2 rounded-md bg-accent p-3">
                <p className="text-xs font-medium text-card-foreground">Items in this meal</p>
                <ul className="divide-y divide-border">
                  {items.map((item, index) => (
                    <li key={index} className="flex items-center justify-between gap-3 py-2">
                      <span className="min-w-0 truncate text-sm text-card-foreground">
                        {item.description}
                      </span>
                      <div className="flex shrink-0 items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          step="any"
                          value={item.quantityGrams}
                          onChange={(e) => updateQuantity(index, Number(e.target.value))}
                          className="h-8 w-20"
                        />
                        <span className="text-xs text-muted-foreground">g</span>
                        <span className="w-16 text-right text-xs tabular-nums text-muted-foreground">
                          {Math.round((item.caloriesPer100g * item.quantityGrams) / 100)} kcal
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Remove item"
                          onClick={() => removeItem(index)}
                        >
                          <Trash2 className="text-destructive" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="pt-1 text-right text-sm font-medium text-card-foreground">
                  Total: {Math.round(totalCalories)} kcal
                </p>
              </div>
            )}

            <Button onClick={handleSaveMeal} disabled={saving}>
              {saving ? 'Saving…' : 'Save meal'}
            </Button>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your meals</CardTitle>
          <CardDescription>Log a whole meal in one tap.</CardDescription>
        </CardHeader>
        <CardContent>
          {actionError && <p className="mb-3 text-sm text-destructive">{actionError}</p>}
          {meals.length === 0 ? (
            <EmptyState icon={UtensilsCrossed} message="Same meal again? Save it, then log it in one tap." />
          ) : (
            <ul className="divide-y divide-border rounded-md border">
              {meals.map((meal) => (
                <li key={meal.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <UtensilsCrossed className="shrink-0 text-muted-foreground" size={18} />
                    <div>
                      <p className="text-sm font-medium text-card-foreground">{meal.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {meal.item_count} item{Number(meal.item_count) === 1 ? '' : 's'} ·{' '}
                        {Math.round(Number(meal.calories))} kcal
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button size="sm" onClick={() => handleLog(meal.id)}>
                      {loggedMealId === meal.id ? 'Logged ✓' : 'Log meal'}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Delete meal"
                      onClick={() => handleDelete(meal.id)}
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

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Build a recipe</CardTitle>
            <CardDescription>
              Combine ingredients into one dish, divide by servings — logs as a single food, not a pile of entries.
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant={showRecipeBuilder ? 'ghost' : 'outline'}
            onClick={() => {
              setShowRecipeBuilder((v) => !v)
              if (showRecipeBuilder) resetRecipeBuilder()
            }}
          >
            {showRecipeBuilder ? (
              'Cancel'
            ) : (
              <>
                <Plus />
                New recipe
              </>
            )}
          </Button>
        </CardHeader>
        {showRecipeBuilder && (
          <CardContent className="space-y-4">
            {recipeBuilderError && <p className="text-sm text-destructive">{recipeBuilderError}</p>}

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-card-foreground">Recipe name</label>
                <Input
                  value={recipeName}
                  onChange={(e) => setRecipeName(e.target.value)}
                  placeholder="e.g. Mom's chili"
                />
              </div>
              <div className="w-28">
                <label className="mb-1 block text-xs font-medium text-card-foreground">Servings</label>
                <Input type="number" min={1} value={servings} onChange={(e) => setServings(e.target.value)} />
              </div>
            </div>

            <form onSubmit={handleRecipeSearch} className="flex gap-2">
              <Input
                value={recipeQuery}
                onChange={(e) => setRecipeQuery(e.target.value)}
                placeholder="Search an ingredient to add"
              />
              <Button type="submit" disabled={recipeSearching}>
                <Search />
                {recipeSearching ? 'Searching…' : 'Search'}
              </Button>
            </form>

            {recipeResults.length > 0 && (
              <ul className="divide-y divide-border rounded-md border">
                {recipeResults.map((food) => (
                  <li key={food.id} className="flex items-center justify-between gap-4 px-4 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-card-foreground">{food.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {Math.round(Number(food.calories_per_100g))} kcal / 100g
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => addIngredient(food)}>
                      <Plus />
                      Add
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            {ingredients.length > 0 && (
              <div className="space-y-2 rounded-md bg-accent p-3">
                <p className="text-xs font-medium text-card-foreground">Ingredients</p>
                <ul className="divide-y divide-border">
                  {ingredients.map((item, index) => (
                    <li key={index} className="flex items-center justify-between gap-3 py-2">
                      <span className="min-w-0 truncate text-sm text-card-foreground">{item.description}</span>
                      <div className="flex shrink-0 items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          step="any"
                          value={item.quantityGrams}
                          onChange={(e) => updateIngredientQuantity(index, Number(e.target.value))}
                          className="h-8 w-20"
                        />
                        <span className="text-xs text-muted-foreground">g</span>
                        <Button size="icon" variant="ghost" aria-label="Remove ingredient" onClick={() => removeIngredient(index)}>
                          <Trash2 className="text-destructive" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="flex items-baseline justify-between pt-1 text-sm">
                  <span className="text-muted-foreground">Total: {Math.round(totalRecipeCalories)} kcal</span>
                  <span className="font-medium text-card-foreground">
                    ~{Math.round(totalRecipeCalories / servingsNum)} kcal / serving
                  </span>
                </div>
              </div>
            )}

            <Button onClick={handleSaveRecipe} disabled={recipeSaving}>
              {recipeSaving ? 'Saving…' : 'Save recipe'}
            </Button>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your recipes</CardTitle>
          <CardDescription>Log one serving in a tap.</CardDescription>
        </CardHeader>
        <CardContent>
          {recipes.length === 0 ? (
            <EmptyState icon={ChefHat} message="Cook it once, log it forever after." />
          ) : (
            <ul className="divide-y divide-border rounded-md border">
              {recipes.map((recipe) => (
                <li key={recipe.recipe_id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <ChefHat className="shrink-0 text-muted-foreground" size={18} />
                    <div>
                      <p className="text-sm font-medium text-card-foreground">{recipe.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {recipe.servings} servings · {Math.round(Number(recipe.calories_per_100g))} kcal / 100g
                        {recipe.serving_size_grams &&
                          ` · ${Math.round((Number(recipe.calories_per_100g) * Number(recipe.serving_size_grams)) / 100)} kcal / serving`}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button size="sm" onClick={() => handleLogRecipe(recipe)}>
                      {loggedRecipeId === recipe.recipe_id ? 'Logged ✓' : 'Log serving'}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Delete recipe"
                      onClick={() => handleDeleteRecipe(recipe.recipe_id)}
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
    </AppLayout>
  )
}
