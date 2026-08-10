// Approximate, widely-cited bodyweight-ratio strength standards (in the
// style of sites like Strength Level / Symmetric Strength) — a 1RM
// expressed as a multiple of bodyweight, bucketed into five tiers. These
// are rough population benchmarks for motivation, not a precise or
// scientific classification.
export type StrengthLevel = 'Beginner' | 'Novice' | 'Intermediate' | 'Advanced' | 'Elite'

const LEVELS: StrengthLevel[] = ['Beginner', 'Novice', 'Intermediate', 'Advanced', 'Elite']

type LiftKey = 'Squat' | 'Bench Press' | 'Deadlift' | 'Overhead Press'

// [Beginner, Novice, Intermediate, Advanced, Elite] thresholds, as a
// multiple of bodyweight.
const STANDARDS: Record<'male' | 'female', Record<LiftKey, number[]>> = {
  male: {
    Squat: [0.5, 0.75, 1.25, 1.75, 2.25],
    'Bench Press': [0.5, 0.75, 1.0, 1.5, 1.75],
    Deadlift: [0.75, 1.0, 1.5, 2.0, 2.5],
    'Overhead Press': [0.35, 0.5, 0.7, 1.0, 1.2],
  },
  female: {
    Squat: [0.35, 0.5, 0.85, 1.2, 1.6],
    'Bench Press': [0.3, 0.4, 0.6, 0.9, 1.1],
    Deadlift: [0.5, 0.7, 1.0, 1.4, 1.8],
    'Overhead Press': [0.2, 0.3, 0.4, 0.6, 0.75],
  },
}

// Recognizes common exercise-name spellings/aliases and maps them to a
// canonical lift key — the exercise-name field elsewhere in the app is
// free text, so this can't rely on exact matches.
const ALIASES: Record<string, LiftKey> = {
  squat: 'Squat',
  'front squat': 'Squat',
  'bench press': 'Bench Press',
  'incline bench press': 'Bench Press',
  'close-grip bench press': 'Bench Press',
  deadlift: 'Deadlift',
  'romanian deadlift': 'Deadlift',
  'overhead press': 'Overhead Press',
  'shoulder press': 'Overhead Press',
  'dumbbell shoulder press': 'Overhead Press',
}

export function liftKeyForExerciseName(name: string): LiftKey | null {
  return ALIASES[name.trim().toLowerCase()] ?? null
}

export interface StrengthBracket {
  level: StrengthLevel
  ratio: number
  nextLevel: StrengthLevel | null
  kgToNextLevel: number | null
}

export function strengthBracket(
  liftKey: LiftKey,
  gender: 'male' | 'female',
  oneRepMaxKg: number,
  bodyweightKg: number
): StrengthBracket | null {
  if (bodyweightKg <= 0) return null
  const thresholds = STANDARDS[gender][liftKey]
  const ratio = oneRepMaxKg / bodyweightKg

  let levelIndex = -1
  for (let i = 0; i < thresholds.length; i++) {
    if (ratio >= thresholds[i]) levelIndex = i
  }

  const level = levelIndex >= 0 ? LEVELS[levelIndex] : ('Beginner' as StrengthLevel)
  const nextIndex = levelIndex + 1
  const nextLevel = nextIndex < LEVELS.length ? LEVELS[nextIndex] : null
  const kgToNextLevel = nextLevel ? Math.max(0, thresholds[nextIndex] * bodyweightKg - oneRepMaxKg) : null

  return { level, ratio, nextLevel, kgToNextLevel }
}
