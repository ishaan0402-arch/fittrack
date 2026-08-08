export const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  heavily_active: 1.725,
} as const;

export type ActivityLevel = keyof typeof ACTIVITY_MULTIPLIERS;
export type Gender = "male" | "female";

export const GOAL_LABELS = {
  bulk: "Bulk",
  cut: "Cut",
  maintain: "Maintain",
  powerlifting: "Powerlifting",
  bodybuilding: "Bodybuilding",
  general_fitness: "General fitness",
} as const;

export type Goal = keyof typeof GOAL_LABELS;

// Calorie offset applied to TDEE. Bulk/cut are the classic +/- 500ish
// surplus/deficit; the strength-and-physique goals lean toward a lean bulk
// since aggressive surpluses mostly add fat, not performance or muscle.
const CALORIE_ADJUSTMENT: Record<Goal, number> = {
  bulk: 350,
  cut: -500,
  maintain: 0,
  powerlifting: 200,
  bodybuilding: 250,
  general_fitness: 0,
};

// Protein target in grams per kg of bodyweight. Cutting needs it highest
// (preserve muscle in a deficit); bodybuilding/powerlifting also run high.
const PROTEIN_G_PER_KG: Record<Goal, number> = {
  bulk: 1.8,
  cut: 2.0,
  maintain: 1.6,
  powerlifting: 2.0,
  bodybuilding: 2.2,
  general_fitness: 1.6,
};

// Fat as a fraction of total calories; carbs fill whatever's left after
// protein and fat are subtracted.
const FAT_CALORIE_SHARE: Record<Goal, number> = {
  bulk: 0.25,
  cut: 0.3,
  maintain: 0.3,
  powerlifting: 0.25,
  bodybuilding: 0.25,
  general_fitness: 0.3,
};

export function calorieTargetForGoal(tdee: number, goal: Goal): number {
  return Math.round(tdee + CALORIE_ADJUSTMENT[goal]);
}

export function macroTargetsForGoal(weightKg: number, goal: Goal, calorieTarget: number) {
  const protein = Math.round(weightKg * PROTEIN_G_PER_KG[goal]);
  const fatCalories = calorieTarget * FAT_CALORIE_SHARE[goal];
  const fat = Math.round(fatCalories / 9);
  const carbsCalories = Math.max(calorieTarget - protein * 4 - fatCalories, 0);
  const carbs = Math.round(carbsCalories / 4);
  return { protein, carbs, fat };
}

// Mifflin-St Jeor — the formula most modern maintenance-calorie calculators
// use (more accurate than the older Harris-Benedict equation).
export function estimateExpenditure(opts: {
  heightCm: number;
  weightKg: number;
  age: number;
  gender: Gender;
  activityLevel: ActivityLevel;
}) {
  const { heightCm, weightKg, age, gender, activityLevel } = opts;
  const bmr =
    10 * weightKg + 6.25 * heightCm - 5 * age + (gender === "male" ? 5 : -161);
  return Math.round(bmr * ACTIVITY_MULTIPLIERS[activityLevel]);
}
