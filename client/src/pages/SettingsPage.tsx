import { useEffect, useState, type FormEvent } from 'react'
import { Download } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AppLayout } from '@/components/app-layout'
import { getProfile, saveProfile, GOAL_OPTIONS, type ActivityLevel, type Goal } from '@/api'

type HeightUnit = 'cm' | 'ftin'
type WeightUnit = 'kg' | 'lb'

const selectClass =
  'h-9 rounded-md border border-input bg-transparent px-2 text-sm text-card-foreground outline-none'

export function SettingsPage() {
  const [loaded, setLoaded] = useState(false)
  const [heightUnit, setHeightUnit] = useState<HeightUnit>('cm')
  const [heightCm, setHeightCm] = useState('170')
  const [heightFeet, setHeightFeet] = useState('5')
  const [heightInches, setHeightInches] = useState('7')
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg')
  const [weight, setWeight] = useState('70')
  const [gender, setGender] = useState<'male' | 'female'>('male')
  const [age, setAge] = useState('25')
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('sedentary')
  const [goal, setGoal] = useState<Goal>('maintain')
  const [targetWeight, setTargetWeight] = useState('')
  const [waterGoalMl, setWaterGoalMl] = useState('2500')
  const [expenditure, setExpenditure] = useState<number | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    getProfile()
      .then((profile) => {
        if (!profile) return
        setHeightCm(String(profile.heightCm))
        setWeight(String(profile.weightKg))
        setGender(profile.gender)
        setAge(String(profile.age))
        setActivityLevel(profile.activityLevel)
        setGoal(profile.goal)
        setTargetWeight(profile.targetWeightKg != null ? String(profile.targetWeightKg) : '')
        setWaterGoalMl(String(profile.waterGoalMl))
        setExpenditure(profile.expenditure)
        setLoaded(true)
      })
      .catch((e) => setError((e as Error).message))
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setSaved(false)
    try {
      const resolvedHeightCm =
        heightUnit === 'cm'
          ? Number(heightCm)
          : Number(heightFeet) * 30.48 + Number(heightInches) * 2.54
      const resolvedWeightKg = weightUnit === 'kg' ? Number(weight) : Number(weight) * 0.453592
      const resolvedTargetWeightKg = targetWeight
        ? weightUnit === 'kg'
          ? Number(targetWeight)
          : Number(targetWeight) * 0.453592
        : null

      const profile = await saveProfile({
        heightCm: resolvedHeightCm,
        weightKg: resolvedWeightKg,
        gender,
        age: Number(age),
        activityLevel,
        goal,
        targetWeightKg: resolvedTargetWeightKg,
        waterGoalMl: Number(waterGoalMl) || 2500,
      })
      setExpenditure(profile.expenditure)
      setSaved(true)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppLayout title="Settings" description="Update your health profile.">
      <Card>
        <CardHeader>
          <CardTitle>Health profile</CardTitle>
          <CardDescription>
            {expenditure
              ? `Current estimated maintenance calories: ${expenditure} kcal`
              : 'Used to estimate your daily calorie needs'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loaded ? (
            <form onSubmit={handleSubmit} className="max-w-md space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm text-card-foreground">Height</label>
                <div className="flex gap-2">
                  {heightUnit === 'cm' ? (
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      required
                      value={heightCm}
                      onChange={(e) => setHeightCm(e.target.value)}
                    />
                  ) : (
                    <>
                      <Input
                        type="number"
                        min={0}
                        placeholder="ft"
                        required
                        value={heightFeet}
                        onChange={(e) => setHeightFeet(e.target.value)}
                      />
                      <Input
                        type="number"
                        min={0}
                        placeholder="in"
                        required
                        value={heightInches}
                        onChange={(e) => setHeightInches(e.target.value)}
                      />
                    </>
                  )}
                  <select
                    value={heightUnit}
                    onChange={(e) => setHeightUnit(e.target.value as HeightUnit)}
                    className={selectClass}
                  >
                    <option value="cm">cm</option>
                    <option value="ftin">ft/in</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm text-card-foreground">Weight</label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    required
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                  />
                  <select
                    value={weightUnit}
                    onChange={(e) => setWeightUnit(e.target.value as WeightUnit)}
                    className={selectClass}
                  >
                    <option value="kg">kg</option>
                    <option value="lb">lb</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm text-card-foreground" htmlFor="target-weight">
                  Target weight <span className="text-muted-foreground">(optional)</span>
                </label>
                <div className="flex gap-2">
                  <Input
                    id="target-weight"
                    type="number"
                    min={0}
                    step="any"
                    value={targetWeight}
                    onChange={(e) => setTargetWeight(e.target.value)}
                    placeholder={weightUnit}
                  />
                  <span className={`${selectClass} flex items-center`}>{weightUnit}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Set this to see a projected ETA on your Dashboard weight chart.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm text-card-foreground" htmlFor="water-goal">
                  Daily water goal (ml)
                </label>
                <Input
                  id="water-goal"
                  type="number"
                  min={0}
                  value={waterGoalMl}
                  onChange={(e) => setWaterGoalMl(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm text-card-foreground" htmlFor="gender">
                  Gender
                </label>
                <select
                  id="gender"
                  value={gender}
                  onChange={(e) => setGender(e.target.value as 'male' | 'female')}
                  className={`${selectClass} w-full`}
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm text-card-foreground" htmlFor="age">
                  Age
                </label>
                <Input
                  id="age"
                  type="number"
                  min={1}
                  required
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm text-card-foreground" htmlFor="activity">
                  Activity level
                </label>
                <select
                  id="activity"
                  value={activityLevel}
                  onChange={(e) => setActivityLevel(e.target.value as ActivityLevel)}
                  className={`${selectClass} w-full`}
                >
                  <option value="sedentary">Sedentary — little or no exercise</option>
                  <option value="lightly_active">Lightly active — 1-3 days/week</option>
                  <option value="moderately_active">Moderately active — 3-5 days/week</option>
                  <option value="heavily_active">Heavily active — 6-7 days/week</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm text-card-foreground" htmlFor="goal">
                  Goal
                </label>
                <select
                  id="goal"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value as Goal)}
                  className={`${selectClass} w-full`}
                >
                  {GOAL_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}
              {saved && !error && <p className="text-sm text-brand">Saved.</p>}
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Saving…' : 'Save changes'}
              </Button>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Export your data</CardTitle>
          <CardDescription>Download your data as CSV files you can open in any spreadsheet app.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <a href="/api/export/food-log.csv" download>
              <Download />
              Food log (CSV)
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href="/api/export/weight-history.csv" download>
              <Download />
              Weight history (CSV)
            </a>
          </Button>
        </CardContent>
      </Card>
    </AppLayout>
  )
}
