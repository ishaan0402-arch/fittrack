import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AuthLayout } from '@/components/auth-layout'
import { saveProfile, GOAL_OPTIONS, type ActivityLevel, type Goal } from '@/api'
import { useAuth } from '@/context/AuthContext'

type HeightUnit = 'cm' | 'ftin'
type WeightUnit = 'kg' | 'lb'

const selectClass =
  'h-9 rounded-md border border-input bg-transparent px-2 text-sm text-card-foreground outline-none'

export function ProfileSetupPage() {
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
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const { refresh } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const resolvedHeightCm =
        heightUnit === 'cm'
          ? Number(heightCm)
          : Number(heightFeet) * 30.48 + Number(heightInches) * 2.54
      const resolvedWeightKg = weightUnit === 'kg' ? Number(weight) : Number(weight) * 0.453592

      await saveProfile({
        heightCm: resolvedHeightCm,
        weightKg: resolvedWeightKg,
        gender,
        age: Number(age),
        activityLevel,
        goal,
      })
      await refresh()
      navigate('/')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      className="max-w-md"
      title="Tell us about you"
      description="We'll use this to estimate your daily calorie needs"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
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
          <p className="text-xs text-muted-foreground">
            Used only for the calorie formula (Mifflin-St Jeor), which is defined by biological
            sex.
          </p>
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
          <p className="text-xs text-muted-foreground">
            We'll adjust your calorie and macro targets to match.
          </p>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? 'Saving…' : 'Continue'}
        </Button>
      </form>
    </AuthLayout>
  )
}
