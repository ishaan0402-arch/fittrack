import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Dumbbell, MessageCircle, TrendingUp, Watch } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AppLayout } from '@/components/app-layout'
import { WeightTrendChart, CaloriesTrendChart } from '@/components/trend-charts'
import { StreakFlame, StreakDayPips } from '@/components/streak-flame'
import {
  getWeightHistory,
  logWeight,
  getCalorieHistory,
  getStreak,
  getWorkoutSummary,
  getNotifications,
  getInsights,
  saveWorkout,
  getProfile,
  type WeightEntry,
  type DailyCalories,
  type WorkoutSummaryEntry,
  type Notification,
  type Insight,
  type Streak,
  type Profile,
} from '@/api'

// Simple linear projection from the trend window's first/last points — good
// enough for "keep at it and you'll get there around X" motivational framing,
// not meant to be a clinical forecast.
function weightGoalEta(
  data: { date: string; weightKg: number }[],
  targetWeightKg: number | null
): string | null {
  if (!targetWeightKg || data.length < 2) return null

  const first = data[0]
  const last = data[data.length - 1]
  const days = (new Date(last.date).getTime() - new Date(first.date).getTime()) / 86_400_000
  if (days < 1) return null

  const ratePerDay = (last.weightKg - first.weightKg) / days
  const remaining = targetWeightKg - last.weightKg

  if (Math.abs(remaining) < 0.1) return "You're basically there."
  if (Math.abs(ratePerDay) < 0.01) return 'Log a few more weigh-ins to project a date.'
  if (Math.sign(ratePerDay) !== Math.sign(remaining)) {
    return "Trending away from your goal right now — that's okay, consistency over time is what counts."
  }

  const daysToGoal = remaining / ratePerDay
  const etaDate = new Date(last.date)
  etaDate.setDate(etaDate.getDate() + Math.round(daysToGoal))
  const formatted = etaDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return daysToGoal <= 1 ? 'Almost there.' : `At this rate: ~${Math.round(daysToGoal)} days to goal (${formatted})`
}

const RANGE_OPTIONS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
]

function RemindersCard({ notifications }: { notifications: Notification[] }) {
  if (notifications.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell size={18} className="text-brand" />
          Reminders
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ul className="space-y-2">
          {notifications.map((n) => (
            <li key={n.id} className="text-sm text-card-foreground">
              {n.message}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function InsightsCard({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp size={18} className="text-brand" />
          Insights
        </CardTitle>
        <CardDescription>Patterns from your logged data</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <ul className="space-y-2">
          {insights.map((i) => (
            <li key={i.id} className="text-sm text-card-foreground">
              {i.message}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

// Streak is FitTrack's one built-in "game mechanic" — a plain clinical
// tracker like Cronometer doesn't lean into this at all, so a bit of
// escalating warmth and an encouraging message per tier is a real point of
// difference, not just decoration.
function streakTier(days: number): { message: string; tier: 0 | 1 | 2 | 3 | 4 } {
  if (days <= 0) return { message: 'Log today to start a streak', tier: 0 }
  if (days < 3) return { message: 'Just getting started', tier: 1 }
  if (days < 7) return { message: 'Building momentum', tier: 2 }
  if (days < 14) return { message: 'One week strong', tier: 3 }
  if (days < 30) return { message: 'Two weeks and counting', tier: 4 }
  return { message: 'A month of consistency — incredible', tier: 4 }
}

function StreakCard({ streak, last7Logged }: { streak: Streak | null; last7Logged: boolean[] }) {
  const current = streak?.streak ?? 0
  const best = streak?.longestStreak ?? 0
  const { message, tier } = streakTier(current)
  const isPersonalBest = current > 0 && current >= best

  return (
    <Card>
      <CardHeader>
        <CardTitle>Streak</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-3 py-2">
        <StreakFlame tier={tier} size={76} />
        <span className="font-hero text-5xl text-card-foreground">{current}</span>
        <p className="label-quiet -mt-2">day{current === 1 ? '' : 's'} in a row</p>
        <p className="text-center text-sm text-muted-foreground">{message}</p>
        <StreakDayPips days={last7Logged} />
        {current > 0 && (
          <p className="text-center text-xs text-muted-foreground">
            {isPersonalBest ? 'Personal best — keep it going' : `Best: ${best} day${best === 1 ? '' : 's'}`}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// Always the trailing 7 calendar days, independent of the chart range toggle
// above it — "how's this week going" shouldn't change when you switch the
// weight/calorie charts to a 90-day view.
function ThisWeekCard({
  calorieData,
  weightData,
  calorieTarget,
}: {
  calorieData: { date: string; calories: number }[]
  weightData: { date: string; weightKg: number }[]
  calorieTarget: number
}) {
  const last7 = calorieData.slice(-7)
  const loggedDays = last7.filter((d) => d.calories > 0)
  const avgCalories =
    loggedDays.length > 0
      ? Math.round(loggedDays.reduce((sum, d) => sum + d.calories, 0) / loggedDays.length)
      : null

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const weekWeights = weightData.filter((w) => new Date(w.date) >= sevenDaysAgo)
  const weightDelta =
    weekWeights.length >= 2 ? weekWeights[weekWeights.length - 1].weightKg - weekWeights[0].weightKg : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>This week</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 py-2">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="font-hero text-3xl text-card-foreground">{loggedDays.length}/7</p>
            <p className="label-quiet">days logged</p>
          </div>
          <div>
            <p className="font-hero text-3xl text-card-foreground">{avgCalories ?? '—'}</p>
            <p className="label-quiet">avg kcal{calorieTarget ? ` / ${calorieTarget}` : ''}</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {weightDelta !== null
            ? `Weight ${weightDelta > 0 ? '+' : ''}${weightDelta.toFixed(1)}kg this week`
            : 'Log a couple more weigh-ins to see this week’s weight change'}
        </p>
      </CardContent>
    </Card>
  )
}

function WeightChangeCard({
  data,
  rangeLabel,
}: {
  data: { date: string; weightKg: number }[]
  rangeLabel: string
}) {
  const delta = data.length >= 2 ? data[data.length - 1].weightKg - data[0].weightKg : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weight change</CardTitle>
        <CardDescription>Over the last {rangeLabel}</CardDescription>
      </CardHeader>
      <CardContent className="py-2">
        {delta === null ? (
          <p className="text-sm text-muted-foreground">Log at least two weigh-ins to see a trend.</p>
        ) : (
          <div className="flex items-baseline gap-2">
            <span className="font-hero text-4xl text-card-foreground">
              {delta > 0 ? '+' : ''}
              {delta.toFixed(1)}
            </span>
            <span className="label-quiet">kg</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function WorkoutSummaryCard({
  entries,
  onLogged,
}: {
  entries: WorkoutSummaryEntry[]
  onLogged: () => void
}) {
  const [quickSummary, setQuickSummary] = useState('')
  const [saving, setSaving] = useState(false)

  const trained = entries.filter((e) => !e.is_rest_day).length
  const todayKey = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in local time
  const today = entries.find((e) => e.date === todayKey)
  const lastWorkout = entries.find((e) => !e.is_rest_day)

  const quickLog = async (isRestDay: boolean) => {
    setSaving(true)
    try {
      await saveWorkout(todayKey, {
        isRestDay,
        summary: isRestDay ? '' : quickSummary,
        felt: null,
        exercises: [],
      })
      setQuickSummary('')
      onLogged()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workouts</CardTitle>
        <CardDescription>Last 7 days</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 py-2">
        <div className="flex items-center gap-3">
          <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-accent">
            <Dumbbell className="text-brand" size={28} />
          </div>
          <div>
            <div className="font-hero text-4xl text-card-foreground">{trained}</div>
            <p className="label-quiet">day{trained === 1 ? '' : 's'} trained</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          {today
            ? today.is_rest_day
              ? "Today: rest day"
              : `Today: ${today.summary || 'Workout'} logged`
            : "Nothing logged today yet"}
        </p>

        {!today && lastWorkout && (
          <p className="text-xs text-muted-foreground">
            Last workout: {lastWorkout.summary || 'Workout'} on{' '}
            {new Date(`${lastWorkout.date}T00:00:00`).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })}
          </p>
        )}

        {!today && (
          <div className="flex gap-2">
            <Input
              value={quickSummary}
              onChange={(e) => setQuickSummary(e.target.value)}
              placeholder="e.g. Push day"
              className="h-8 text-sm"
            />
            <Button size="sm" disabled={saving || !quickSummary.trim()} onClick={() => quickLog(false)}>
              Log
            </Button>
          </div>
        )}
        {!today && (
          <Button size="sm" variant="outline" className="w-full" disabled={saving} onClick={() => quickLog(true)}>
            Mark as rest day
          </Button>
        )}

        <Button asChild variant="ghost" size="sm" className="w-full">
          <Link to="/workouts">
            <Dumbbell />
            {today ? 'Edit in Workouts' : 'Log exercises in detail'}
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}

function CoachCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Coach</CardTitle>
        <CardDescription>Get advice based on your actual progress</CardDescription>
      </CardHeader>
      <CardContent className="py-2">
        <Button asChild className="w-full">
          <Link to="/coach">
            <MessageCircle />
            Ask your coach
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}

function ConnectedDevicesCard() {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Watch size={18} className="text-muted-foreground" />
          Connected devices
        </CardTitle>
        <CardDescription>Garmin sync (sleep, activity) is planned but not built yet.</CardDescription>
      </CardHeader>
    </Card>
  )
}

export function DashboardPage() {
  const [days, setDays] = useState(30)
  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>([])
  const [calorieDays, setCalorieDays] = useState<DailyCalories[]>([])
  const [streak, setStreak] = useState<Streak | null>(null)
  const [workoutSummary, setWorkoutSummary] = useState<WorkoutSummaryEntry[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [insights, setInsights] = useState<Insight[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [weightInput, setWeightInput] = useState('')
  const [logging, setLogging] = useState(false)

  const refresh = () => {
    getWeightHistory(days)
      .then(setWeightEntries)
      .catch((e) => setError((e as Error).message))
    getCalorieHistory(days)
      .then(setCalorieDays)
      .catch((e) => setError((e as Error).message))
  }

  useEffect(refresh, [days])

  const refreshWorkoutSummary = () => {
    getWorkoutSummary(7)
      .then(setWorkoutSummary)
      .catch((e) => setError((e as Error).message))
  }

  useEffect(() => {
    getStreak()
      .then(setStreak)
      .catch((e) => setError((e as Error).message))
    refreshWorkoutSummary()
    getNotifications()
      .then(setNotifications)
      .catch((e) => setError((e as Error).message))
    getInsights()
      .then(setInsights)
      .catch((e) => setError((e as Error).message))
    getProfile()
      .then(setProfile)
      .catch((e) => setError((e as Error).message))
  }, [])

  const handleLogWeight = async (e: FormEvent) => {
    e.preventDefault()
    const kg = Number(weightInput)
    if (!kg || kg <= 0) return
    setLogging(true)
    setError(null)
    try {
      await logWeight(kg)
      setWeightInput('')
      refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLogging(false)
    }
  }

  const weightData = weightEntries.map((w) => ({ date: w.logged_at, weightKg: Number(w.weight_kg) }))
  const calorieData = calorieDays.map((d) => ({ date: d.date, calories: Number(d.calories) }))
  const rangeLabel = RANGE_OPTIONS.find((o) => o.days === days)?.label ?? `${days}d`
  const last7Logged = calorieData.slice(-7).map((d) => d.calories > 0)
  const eta = weightGoalEta(weightData, profile?.targetWeightKg ?? null)

  return (
    <AppLayout title="Dashboard" description="Your progress over time." maxWidth="max-w-5xl">
      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <RemindersCard notifications={notifications} />
      <InsightsCard insights={insights} />

      <div className="flex justify-end gap-1">
        {RANGE_OPTIONS.map((opt) => (
          <Button
            key={opt.days}
            size="sm"
            variant={opt.days === days ? 'default' : 'outline'}
            onClick={() => setDays(opt.days)}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Weight</CardTitle>
              <CardDescription>
                {weightEntries.length > 0
                  ? `Latest: ${weightEntries[weightEntries.length - 1].weight_kg} kg`
                  : 'Log a weigh-in to start your trend'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <WeightTrendChart data={weightData} />
              <form onSubmit={handleLogWeight} className="flex gap-2">
                <Input
                  type="number"
                  min={0}
                  step="any"
                  placeholder="Weight (kg)"
                  value={weightInput}
                  onChange={(e) => setWeightInput(e.target.value)}
                />
                <Button type="submit" disabled={logging || !weightInput}>
                  {logging ? 'Logging…' : 'Log weight'}
                </Button>
              </form>
              {eta && (
                <p className="text-xs text-muted-foreground">
                  {profile?.targetWeightKg != null && `Goal: ${profile.targetWeightKg}kg · `}
                  {eta}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Calories consumed</CardTitle>
              <CardDescription>Daily totals, including days with nothing logged</CardDescription>
            </CardHeader>
            <CardContent>
              <CaloriesTrendChart data={calorieData} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <StreakCard streak={streak} last7Logged={last7Logged} />
          <ThisWeekCard
            calorieData={calorieData}
            weightData={weightData}
            calorieTarget={profile?.calorieTarget ?? 0}
          />
          <WeightChangeCard data={weightData} rangeLabel={rangeLabel} />
          <WorkoutSummaryCard entries={workoutSummary} onLogged={refreshWorkoutSummary} />
          <CoachCard />
          <ConnectedDevicesCard />
        </div>
      </div>
    </AppLayout>
  )
}
