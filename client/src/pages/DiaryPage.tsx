import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Camera, CopyPlus, Mic, Pencil, Plus, Search, Sparkles, Trash2, Type, X } from 'lucide-react'
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
  estimatePhotoNutrition,
  estimateTextNutrition,
  getMealSuggestions,
  getProfile,
  getAdaptiveTarget,
  defaultMealType,
  MEAL_TYPES,
  MEAL_TYPE_LABELS,
  type Food,
  type DayTotals,
  type LogEntry,
  type NutrientTotal,
  type NutritionEstimateItem,
  type MealSuggestions,
  type AdaptiveTarget,
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

// Form-editable mirror of NutritionEstimateItem — numbers as strings so they
// bind directly to <Input> the same way every other editable-quantity form
// here does. Shared by both the photo and text AI-logging flows.
interface EditableNutritionItem {
  description: string
  quantityGrams: string
  calories: string
  proteinG: string
  carbsG: string
  fatG: string
  note: string
}

function toEditableItems(items: NutritionEstimateItem[]): EditableNutritionItem[] {
  return items.map((item) => ({
    description: item.description,
    quantityGrams: String(Math.round(item.estimatedQuantityGrams)),
    calories: String(Math.round(item.calories)),
    proteinG: String(Math.round(item.proteinG)),
    carbsG: String(Math.round(item.carbsG)),
    fatG: String(Math.round(item.fatG)),
    note: item.note,
  }))
}

export function DiaryPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [adaptiveTarget, setAdaptiveTarget] = useState<AdaptiveTarget | null>(null)

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
  const [copyDateOpen, setCopyDateOpen] = useState(false)
  const [copyDate, setCopyDate] = useState('')
  const [undoEntry, setUndoEntry] = useState<LogEntry | null>(null)
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [editingEntryId, setEditingEntryId] = useState<number | null>(null)
  const [editQuantity, setEditQuantity] = useState('')
  const [editNote, setEditNote] = useState('')
  const [editMealType, setEditMealType] = useState<MealType>('breakfast')

  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [quickCalories, setQuickCalories] = useState('')
  const [quickDescription, setQuickDescription] = useState('')
  const [quickMealType, setQuickMealType] = useState<MealType>(defaultMealType())
  const [quickAdding, setQuickAdding] = useState(false)

  const [aiAnalyzing, setAiAnalyzing] = useState(false)
  const [aiItems, setAiItems] = useState<EditableNutritionItem[] | null>(null)
  const [aiMealType, setAiMealType] = useState<MealType>(defaultMealType())
  const [aiLogging, setAiLogging] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [textLogOpen, setTextLogOpen] = useState(false)
  const [textDescription, setTextDescription] = useState('')
  const [listening, setListening] = useState(false)
  // Web Speech API has no TS DOM lib types yet, hence `any` here.
  const recognitionRef = useRef<any>(null)

  const [suggesting, setSuggesting] = useState(false)
  const [suggestions, setSuggestions] = useState<MealSuggestions | null>(null)
  const [suggestError, setSuggestError] = useState<string | null>(null)
  const [loggingSuggestionIndex, setLoggingSuggestionIndex] = useState<number | null>(null)

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
    getAdaptiveTarget()
      .then((t) => setAdaptiveTarget(t.available ? t : null))
      .catch(() => {})
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

  const handleRemove = async (entry: LogEntry) => {
    try {
      await deleteLogEntry(entry.id)
      refreshLog()
      setUndoEntry(entry)
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
      undoTimerRef.current = setTimeout(() => setUndoEntry(null), 6000)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  // Re-logs the same food/quantity/note/meal type as a new entry — the
  // deleted row itself is gone, but the result is indistinguishable to the
  // user. No new backend endpoint needed since the entry's data is already
  // in hand from before the delete call.
  const handleUndoRemove = async () => {
    if (!undoEntry) return
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    const entry = undoEntry
    setUndoEntry(null)
    try {
      await logFood(entry.food_id, Number(entry.quantity_grams), entry.note ?? undefined, entry.meal_type)
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

  const handlePhotoSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (photoInputRef.current) photoInputRef.current.value = ''
    if (!file) return

    setAiAnalyzing(true)
    setAiItems(null)
    setError(null)
    try {
      const result = await estimatePhotoNutrition(file)
      setAiItems(toEditableItems(result.items))
      setAiMealType(defaultMealType())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setAiAnalyzing(false)
    }
  }

  const handleTextEstimate = async (e: FormEvent) => {
    e.preventDefault()
    const description = textDescription.trim()
    if (!description) return

    setAiAnalyzing(true)
    setAiItems(null)
    setError(null)
    try {
      const result = await estimateTextNutrition(description)
      setAiItems(toEditableItems(result.items))
      setAiMealType(defaultMealType())
      setTextDescription('')
      setTextLogOpen(false)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setAiAnalyzing(false)
    }
  }

  const speechSupported =
    typeof window !== 'undefined' && Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)

  const handleVoiceInput = () => {
    if (listening) {
      recognitionRef.current?.stop()
      return
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) return

    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript
      setTextDescription((prev) => (prev ? `${prev} ${transcript}` : transcript))
    }
    recognition.onend = () => setListening(false)
    recognition.onerror = () => setListening(false)
    recognitionRef.current = recognition
    setListening(true)
    recognition.start()
  }

  const updateAiItem = (index: number, patch: Partial<EditableNutritionItem>) => {
    setAiItems((items) => items && items.map((it, i) => (i === index ? { ...it, ...patch } : it)))
  }

  const removeAiItem = (index: number) => {
    setAiItems((items) => items && items.filter((_, i) => i !== index))
  }

  // Same one-off-custom-food trick as Quick Add: each item becomes its own
  // food row sized exactly to what's being logged (servingSizeGrams ==
  // quantityGrams), so the numbers the user confirmed reproduce exactly.
  const confirmAiLog = async () => {
    if (!aiItems || aiItems.length === 0) return
    setAiLogging(true)
    setError(null)
    try {
      for (const item of aiItems) {
        const grams = Number(item.quantityGrams)
        const calories = Number(item.calories)
        if (!grams || grams <= 0 || !calories || calories < 0) continue
        const food = await createCustomFood({
          description: item.description.trim() || 'AI logged food',
          servingSizeGrams: grams,
          calories,
          protein: Number(item.proteinG) || undefined,
          carbs: Number(item.carbsG) || undefined,
          fat: Number(item.fatG) || undefined,
        })
        await logFood(food.id, grams, undefined, aiMealType)
      }
      setAiItems(null)
      refreshLog()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setAiLogging(false)
    }
  }

  const handleSuggest = async () => {
    setSuggesting(true)
    setSuggestError(null)
    try {
      setSuggestions(await getMealSuggestions())
    } catch (e) {
      setSuggestError((e as Error).message)
    } finally {
      setSuggesting(false)
    }
  }

  // Same one-off-custom-food trick as the other AI logging flows — the
  // suggestion's numbers become the food's entire nutrition profile, sized
  // to exactly the quantity suggested.
  const handleLogSuggestion = async (index: number) => {
    if (!suggestions) return
    const item = suggestions.items[index]
    setLoggingSuggestionIndex(index)
    setError(null)
    try {
      const food = await createCustomFood({
        description: item.name,
        servingSizeGrams: item.quantityGrams,
        calories: item.calories,
        protein: item.proteinG,
        carbs: item.carbsG,
        fat: item.fatG,
      })
      await logFood(food.id, item.quantityGrams, undefined, defaultMealType())
      setSuggestions((s) => (s ? { ...s, items: s.items.filter((_, i) => i !== index) } : s))
      refreshLog()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoggingSuggestionIndex(null)
    }
  }

  const handleCopyFromDate = async (dateKey: string) => {
    if (!dateKey) return
    setCopying(true)
    setError(null)
    try {
      const source = await getLogForDate(dateKey)
      if (source.entries.length === 0) {
        setError(`Nothing was logged on ${dateKey}.`)
        return
      }
      for (const entry of source.entries) {
        await logFood(entry.food_id, Number(entry.quantity_grams), entry.note ?? undefined, entry.meal_type)
      }
      refreshLog()
      setCopyDateOpen(false)
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

      {undoEntry && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-accent px-4 py-2 text-sm text-card-foreground">
          <span className="truncate">Removed "{undoEntry.description}".</span>
          <div className="flex shrink-0 items-center gap-1">
            <Button size="sm" variant="outline" onClick={handleUndoRemove}>
              Undo
            </Button>
            <Button size="icon" variant="ghost" aria-label="Dismiss" onClick={() => setUndoEntry(null)}>
              <X size={16} />
            </Button>
          </div>
        </div>
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

          {adaptiveTarget && (
            <div className="rounded-md border border-brand/30 bg-accent/60 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-card-foreground">
                Adaptive target: {adaptiveTarget.calorieTarget} kcal
              </span>{' '}
              — based on your actual {adaptiveTarget.daysOfData}-day weight trend (
              {(adaptiveTarget.actualWeeklyRateKg ?? 0) > 0 ? '+' : ''}
              {adaptiveTarget.actualWeeklyRateKg}kg/week vs. an expected{' '}
              {(adaptiveTarget.expectedWeeklyRateKg ?? 0) > 0 ? '+' : ''}
              {adaptiveTarget.expectedWeeklyRateKg}kg/week), not just the formula estimate above.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What should I eat?</CardTitle>
          <CardDescription>
            AI-suggested meals sized to exactly what you have left today — tap one to log it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {suggestError && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {suggestError}
            </p>
          )}
          {!suggestions ? (
            <Button onClick={handleSuggest} disabled={suggesting}>
              <Sparkles size={16} />
              {suggesting ? 'Thinking…' : 'Suggest something'}
            </Button>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Remaining: {suggestions.remaining.calories} kcal · {suggestions.remaining.protein}g protein ·{' '}
                {suggestions.remaining.carbs}g carbs · {suggestions.remaining.fat}g fat
              </p>
              {suggestions.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Logged them all — nice.</p>
              ) : (
                <div className="space-y-2">
                  {suggestions.items.map((item, index) => (
                    <div
                      key={`${item.name}-${index}`}
                      className="flex items-start justify-between gap-3 rounded-md border border-border p-3"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-card-foreground">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.quantityGrams}g · {item.calories} kcal · {item.proteinG}p / {item.carbsG}c /{' '}
                          {item.fatG}f
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">{item.reason}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0"
                        onClick={() => handleLogSuggestion(index)}
                        disabled={loggingSuggestionIndex !== null}
                      >
                        {loggingSuggestionIndex === index ? 'Logging…' : 'Log it'}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <Button size="sm" variant="ghost" onClick={handleSuggest} disabled={suggesting}>
                {suggesting ? 'Thinking…' : 'More ideas'}
              </Button>
            </>
          )}
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

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">or</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              {aiAnalyzing ? (
                <p className="rounded-md border border-dashed p-3 text-center text-sm text-muted-foreground">
                  Analyzing…
                </p>
              ) : aiItems ? (
                <div className="space-y-3 rounded-md bg-accent p-3">
                  {aiItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Couldn't identify any food there. Try again with more detail, or add it manually above.
                    </p>
                  ) : (
                    <>
                      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                        Review before logging
                      </p>
                      {aiItems.map((item, index) => (
                        <div key={index} className="space-y-2 rounded-md border bg-card p-2.5">
                          <div className="flex items-center gap-2">
                            <Input
                              value={item.description}
                              onChange={(e) => updateAiItem(index, { description: e.target.value })}
                              className="flex-1"
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label="Remove item"
                              onClick={() => removeAiItem(index)}
                            >
                              <X size={15} />
                            </Button>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                min={0}
                                step="any"
                                value={item.quantityGrams}
                                onChange={(e) => updateAiItem(index, { quantityGrams: e.target.value })}
                                className="w-20"
                              />
                              <span className="text-xs text-muted-foreground">g</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                min={0}
                                step="any"
                                value={item.calories}
                                onChange={(e) => updateAiItem(index, { calories: e.target.value })}
                                className="w-20"
                              />
                              <span className="text-xs text-muted-foreground">kcal</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                min={0}
                                step="any"
                                value={item.proteinG}
                                onChange={(e) => updateAiItem(index, { proteinG: e.target.value })}
                                className="w-16"
                              />
                              <span className="text-xs text-muted-foreground">P</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                min={0}
                                step="any"
                                value={item.carbsG}
                                onChange={(e) => updateAiItem(index, { carbsG: e.target.value })}
                                className="w-16"
                              />
                              <span className="text-xs text-muted-foreground">C</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                min={0}
                                step="any"
                                value={item.fatG}
                                onChange={(e) => updateAiItem(index, { fatG: e.target.value })}
                                className="w-16"
                              />
                              <span className="text-xs text-muted-foreground">F</span>
                            </div>
                          </div>
                          {item.note && <p className="text-xs text-muted-foreground">{item.note}</p>}
                        </div>
                      ))}
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={aiMealType}
                          onChange={(e) => setAiMealType(e.target.value as MealType)}
                          className="h-9 rounded-md border border-input bg-transparent px-2 text-sm text-card-foreground outline-none"
                        >
                          {MEAL_TYPES.map((mt) => (
                            <option key={mt} value={mt}>
                              {MEAL_TYPE_LABELS[mt]}
                            </option>
                          ))}
                        </select>
                        <Button size="sm" onClick={confirmAiLog} disabled={aiLogging}>
                          {aiLogging
                            ? 'Logging…'
                            : `Log ${aiItems.length} item${aiItems.length === 1 ? '' : 's'}`}
                        </Button>
                      </div>
                    </>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setAiItems(null)}>
                    Cancel
                  </Button>
                </div>
              ) : textLogOpen ? (
                <form onSubmit={handleTextEstimate} className="space-y-2 rounded-md bg-accent p-3">
                  <div className="flex gap-2">
                    <Input
                      value={textDescription}
                      onChange={(e) => setTextDescription(e.target.value)}
                      placeholder="e.g. grilled chicken sandwich and a side salad"
                      className="flex-1"
                      autoFocus
                    />
                    {speechSupported && (
                      <Button
                        type="button"
                        size="icon"
                        variant={listening ? 'default' : 'outline'}
                        aria-label={listening ? 'Stop listening' : 'Speak instead of typing'}
                        onClick={handleVoiceInput}
                      >
                        <Mic className={listening ? 'animate-pulse' : undefined} />
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="submit" size="sm" disabled={!textDescription.trim()}>
                      Estimate nutrition
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setTextLogOpen(false)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="flex gap-2">
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handlePhotoSelected}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => photoInputRef.current?.click()}
                  >
                    <Camera />
                    Photo
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setTextLogOpen(true)}
                  >
                    <Type />
                    Describe it
                  </Button>
                </div>
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
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>Today's log</CardTitle>
          {copyDateOpen ? (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={copyDate}
                max={yesterdayKey()}
                onChange={(e) => setCopyDate(e.target.value)}
                className="h-8 rounded-md border border-input bg-transparent px-2 text-sm text-card-foreground outline-none"
              />
              <Button size="sm" onClick={() => handleCopyFromDate(copyDate)} disabled={!copyDate || copying}>
                {copying ? 'Copying…' : 'Copy'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setCopyDateOpen(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setCopyDate(yesterdayKey())
                setCopyDateOpen(true)
              }}
            >
              <CopyPlus />
              Copy a day
            </Button>
          )}
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
                                  onClick={() => handleRemove(entry)}
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
