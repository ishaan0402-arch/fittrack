export const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  heavily_active: 1.725,
} as const;

export type ActivityLevel = keyof typeof ACTIVITY_MULTIPLIERS;
export type Gender = "male" | "female";

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
