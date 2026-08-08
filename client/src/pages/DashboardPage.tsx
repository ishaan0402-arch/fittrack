import { useEffect, useState, type FormEvent } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AppLayout } from '@/components/app-layout'
import { WeightTrendChart, CaloriesTrendChart } from '@/components/trend-charts'
import { getWeightHistory, logWeight, getCalorieHistory, type WeightEntry, type DailyCalories } from '@/api'
import { cn } from '@/lib/utils'

const RANGE_OPTIONS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
]

export function DashboardPage() {
  const [days, setDays] = useState(30)
  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>([])
  const [calorieDays, setCalorieDays] = useState<DailyCalories[]>([])
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

  return (
    <AppLayout title="Dashboard" description="Your progress over time.">
      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

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

      <Card className={cn('border-dashed')}>
        <CardHeader>
          <CardTitle>Connected devices</CardTitle>
          <CardDescription>
            Garmin sync (sleep, activity) is planned but not built yet.
          </CardDescription>
        </CardHeader>
      </Card>
    </AppLayout>
  )
}
