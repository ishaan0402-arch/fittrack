import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { AppLayout } from '@/components/app-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  getWorkoutsForMonth,
  saveWorkout,
  deleteWorkout,
  getExerciseHistory,
  type Workout,
  type WorkoutExercise,
  type FeltRating,
  type ExerciseHistoryEntry,
} from '@/api'

const FELT_OPTIONS: { value: FeltRating; label: string }[] = [
  { value: 'great', label: 'Great' },
  { value: 'good', label: 'Good' },
  { value: 'okay', label: 'Okay' },
  { value: 'tired', label: 'Tired' },
  { value: 'bad', label: 'Bad' },
]

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function toDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function todayKey(): string {
  const now = new Date()
  return toDateKey(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

// Standard microload bump, rounded to the nearest 2.5kg plate increment —
// mirrors the classic progressive-overload heuristic (small, steady jumps
// at the same rep target rather than guessing a percentage).
function suggestNextWeight(lastWeightKg: number): number {
  return Math.round((lastWeightKg + 2.5) / 2.5) * 2.5
}

interface EditForm {
  isRestDay: boolean
  summary: string
  felt: FeltRating | null
  exercises: WorkoutExercise[]
}

const EMPTY_FORM: EditForm = { isRestDay: false, summary: '', felt: null, exercises: [] }

export function WorkoutsPage() {
  const [cursor, setCursor] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() + 1 }
  })
  const [workouts, setWorkouts] = useState<Record<string, Workout>>({})
  const [exerciseHistory, setExerciseHistory] = useState<Record<string, ExerciseHistoryEntry>>({})
  const [error, setError] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<string>(todayKey())
  const [form, setForm] = useState<EditForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const refresh = () => {
    getWorkoutsForMonth(cursor.year, cursor.month)
      .then((rows) => {
        const map: Record<string, Workout> = {}
        for (const w of rows) map[w.date.slice(0, 10)] = w
        setWorkouts(map)
      })
      .catch((e) => setError((e as Error).message))
  }

  useEffect(refresh, [cursor.year, cursor.month])

  useEffect(() => {
    getExerciseHistory()
      .then((rows) => {
        const map: Record<string, ExerciseHistoryEntry> = {}
        for (const row of rows) map[row.name.trim().toLowerCase()] = row
        setExerciseHistory(map)
      })
      .catch((e) => setError((e as Error).message))
  }, [])

  useEffect(() => {
    const existing = workouts[selectedDate]
    if (existing) {
      setForm({
        isRestDay: existing.is_rest_day,
        summary: existing.summary ?? '',
        felt: existing.felt,
        exercises: existing.exercises,
      })
    } else {
      setForm(EMPTY_FORM)
    }
  }, [selectedDate, workouts])

  const exerciseNames = useMemo(
    () => Object.values(exerciseHistory).map((h) => h.name),
    [exerciseHistory]
  )

  const cells = useMemo(() => {
    const firstWeekday = new Date(cursor.year, cursor.month - 1, 1).getDay()
    const daysInMonth = new Date(cursor.year, cursor.month, 0).getDate()
    const blanks: (number | null)[] = Array(firstWeekday).fill(null)
    const days: (number | null)[] = Array.from({ length: daysInMonth }, (_, i) => i + 1)
    return [...blanks, ...days]
  }, [cursor])

  const changeMonth = (delta: number) => {
    setCursor(({ year, month }) => {
      const d = new Date(year, month - 1 + delta, 1)
      return { year: d.getFullYear(), month: d.getMonth() + 1 }
    })
  }

  const addExerciseRow = () => {
    setForm((f) => ({
      ...f,
      exercises: [...f.exercises, { name: '', sets: null, reps: null, weightKg: null }],
    }))
  }

  const updateExercise = (index: number, patch: Partial<WorkoutExercise>) => {
    setForm((f) => ({
      ...f,
      exercises: f.exercises.map((ex, i) => (i === index ? { ...ex, ...patch } : ex)),
    }))
  }

  const removeExercise = (index: number) => {
    setForm((f) => ({ ...f, exercises: f.exercises.filter((_, i) => i !== index) }))
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await saveWorkout(selectedDate, {
        isRestDay: form.isRestDay,
        summary: form.summary,
        felt: form.felt,
        exercises: form.exercises.filter((ex) => ex.name.trim()),
      })
      refresh()
      getExerciseHistory().then((rows) => {
        const map: Record<string, ExerciseHistoryEntry> = {}
        for (const row of rows) map[row.name.trim().toLowerCase()] = row
        setExerciseHistory(map)
      })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setSaving(true)
    setError(null)
    try {
      await deleteWorkout(selectedDate)
      setForm(EMPTY_FORM)
      refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const monthLabel = new Date(cursor.year, cursor.month - 1, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })

  return (
    <AppLayout
      title="Workouts"
      description="Log each day's workout — or rest — and track how it felt and what you lifted."
      maxWidth="max-w-4xl"
    >
      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{monthLabel}</CardTitle>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" aria-label="Previous month" onClick={() => changeMonth(-1)}>
              <ChevronLeft />
            </Button>
            <Button size="icon" variant="ghost" aria-label="Next month" onClick={() => changeMonth(1)}>
              <ChevronRight />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
            {WEEKDAYS.map((d) => (
              <div key={d} className="pb-1.5 label-quiet">
                {d[0]}
              </div>
            ))}
            {cells.map((day, i) => {
              if (day === null) return <div key={`b${i}`} />
              const dateKey = toDateKey(cursor.year, cursor.month, day)
              const workout = workouts[dateKey]
              const isSelected = dateKey === selectedDate
              const isToday = dateKey === todayKey()
              return (
                <button
                  key={dateKey}
                  onClick={() => setSelectedDate(dateKey)}
                  aria-label={`${dateKey}${workout?.is_rest_day ? ', rest day' : workout ? ', workout logged' : ''}`}
                  className={cn(
                    'flex h-11 flex-col items-center justify-center gap-1 rounded-md border transition-colors',
                    isSelected ? 'border-brand bg-accent' : 'border-transparent hover:bg-accent/60'
                  )}
                >
                  <span
                    className={cn(
                      'flex size-6 items-center justify-center rounded-full text-xs',
                      isToday ? 'bg-brand text-brand-foreground' : 'text-card-foreground'
                    )}
                  >
                    {day}
                  </span>
                  <span className="flex h-1.5 items-center justify-center">
                    {workout?.is_rest_day && <span className="size-1.5 rounded-full bg-muted-foreground" />}
                    {workout && !workout.is_rest_day && <span className="size-1.5 rounded-full bg-brand" />}
                  </span>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {new Date(`${selectedDate}T00:00:00`).toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </CardTitle>
          <CardDescription>Log what you did, or mark it as a rest day.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-2 text-sm text-card-foreground">
            <input
              type="checkbox"
              checked={form.isRestDay}
              onChange={(e) => setForm((f) => ({ ...f, isRestDay: e.target.checked }))}
            />
            Rest day
          </label>

          {!form.isRestDay && (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-card-foreground">
                  Summary (e.g. "Push day", "Legs")
                </label>
                <Input
                  value={form.summary}
                  onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
                  placeholder="What kind of workout was it?"
                />
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-card-foreground">Exercises</p>
                <datalist id="exercise-names">
                  {exerciseNames.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
                {form.exercises.map((ex, index) => {
                  const history = exerciseHistory[ex.name.trim().toLowerCase()]
                  const showSuggestion = history && ex.weightKg == null && history.date !== selectedDate
                  const suggestedWeight = history ? suggestNextWeight(Number(history.weightKg)) : null

                  return (
                    <div key={index} className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          value={ex.name}
                          onChange={(e) => updateExercise(index, { name: e.target.value })}
                          placeholder="Exercise, e.g. Bench press"
                          className="min-w-40 flex-1"
                          list="exercise-names"
                        />
                        <Input
                          type="number"
                          min={0}
                          value={ex.sets ?? ''}
                          onChange={(e) =>
                            updateExercise(index, { sets: e.target.value ? Number(e.target.value) : null })
                          }
                          placeholder="Sets"
                          className="w-20"
                        />
                        <Input
                          type="number"
                          min={0}
                          value={ex.reps ?? ''}
                          onChange={(e) =>
                            updateExercise(index, { reps: e.target.value ? Number(e.target.value) : null })
                          }
                          placeholder="Reps"
                          className="w-20"
                        />
                        <Input
                          type="number"
                          min={0}
                          step="any"
                          value={ex.weightKg ?? ''}
                          onChange={(e) =>
                            updateExercise(index, { weightKg: e.target.value ? Number(e.target.value) : null })
                          }
                          placeholder="Weight (kg)"
                          className="w-28"
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Remove exercise"
                          onClick={() => removeExercise(index)}
                        >
                          <Trash2 className="text-destructive" size={16} />
                        </Button>
                      </div>

                      {showSuggestion && (
                        <p className="pl-1 text-xs text-muted-foreground">
                          Last time: {history.weightKg}kg × {history.reps ?? '?'} — try{' '}
                          <button
                            type="button"
                            className="font-medium text-brand underline"
                            onClick={() =>
                              updateExercise(index, {
                                weightKg: suggestedWeight,
                                reps: history.reps,
                                sets: ex.sets ?? history.sets,
                              })
                            }
                          >
                            {suggestedWeight}kg × {history.reps ?? '?'}
                          </button>
                        </p>
                      )}
                    </div>
                  )
                })}
                <Button size="sm" variant="outline" onClick={addExerciseRow}>
                  <Plus />
                  Add exercise
                </Button>
              </div>
            </>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-card-foreground">How did it feel?</label>
            <select
              value={form.felt ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, felt: (e.target.value || null) as FeltRating | null }))}
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm text-card-foreground outline-none"
            >
              <option value="">Not set</option>
              {FELT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
            {workouts[selectedDate] && (
              <Button variant="ghost" onClick={handleDelete} disabled={saving}>
                Clear this day
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </AppLayout>
  )
}
