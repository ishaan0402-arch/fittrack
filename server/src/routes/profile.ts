import { Router } from "express";
import { pool } from "../db.js";
import { asyncHandler } from "../asyncHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";
import {
  ACTIVITY_MULTIPLIERS,
  estimateExpenditure,
  calorieTargetForGoal,
  macroTargetsForGoal,
  expectedWeeklyRateKg,
  GOAL_LABELS,
  type ActivityLevel,
  type Gender,
  type Goal,
} from "../expenditure.js";

export const profileRouter = Router();
profileRouter.use(requireAuth);

const PROFILE_COLUMNS =
  "height_cm, weight_kg, gender, age, activity_level, goal, target_weight_kg, water_goal_ml";

function toProfileResponse(row: {
  height_cm: string;
  weight_kg: string;
  gender: Gender;
  age: number;
  activity_level: ActivityLevel;
  goal: Goal;
  target_weight_kg: string | null;
  water_goal_ml: number;
}) {
  const heightCm = Number(row.height_cm);
  const weightKg = Number(row.weight_kg);
  const expenditure = estimateExpenditure({
    heightCm,
    weightKg,
    age: row.age,
    gender: row.gender,
    activityLevel: row.activity_level,
  });
  const calorieTarget = calorieTargetForGoal(expenditure, row.goal);
  return {
    heightCm,
    weightKg,
    gender: row.gender,
    age: row.age,
    activityLevel: row.activity_level,
    goal: row.goal,
    targetWeightKg: row.target_weight_kg != null ? Number(row.target_weight_kg) : null,
    waterGoalMl: row.water_goal_ml,
    expenditure,
    calorieTarget,
    macroTargets: macroTargetsForGoal(weightKg, row.goal, calorieTarget),
  };
}

profileRouter.get("/", asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT ${PROFILE_COLUMNS} FROM user_profiles WHERE user_id = $1`,
    [req.userId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: "No profile yet" });
    return;
  }
  res.json(toProfileResponse(result.rows[0]));
}));

profileRouter.put("/", asyncHandler(async (req, res) => {
  const { heightCm, weightKg, gender, age, activityLevel, goal, targetWeightKg, waterGoalMl } =
    req.body as {
      heightCm?: number;
      weightKg?: number;
      gender?: string;
      age?: number;
      activityLevel?: string;
      goal?: string;
      targetWeightKg?: number | null;
      waterGoalMl?: number;
    };

  if (
    !heightCm || heightCm <= 0 ||
    !weightKg || weightKg <= 0 ||
    !age || age <= 0 ||
    (gender !== "male" && gender !== "female") ||
    !activityLevel || !(activityLevel in ACTIVITY_MULTIPLIERS) ||
    !goal || !(goal in GOAL_LABELS) ||
    (targetWeightKg != null && targetWeightKg <= 0) ||
    (waterGoalMl != null && waterGoalMl <= 0)
  ) {
    res.status(400).json({ error: "Invalid profile data" });
    return;
  }

  await pool.query(
    `INSERT INTO user_profiles (user_id, height_cm, weight_kg, gender, age, activity_level, goal, target_weight_kg, water_goal_ml, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
     ON CONFLICT (user_id) DO UPDATE SET
       height_cm = EXCLUDED.height_cm,
       weight_kg = EXCLUDED.weight_kg,
       gender = EXCLUDED.gender,
       age = EXCLUDED.age,
       activity_level = EXCLUDED.activity_level,
       goal = EXCLUDED.goal,
       target_weight_kg = EXCLUDED.target_weight_kg,
       water_goal_ml = EXCLUDED.water_goal_ml,
       updated_at = now()`,
    [req.userId, heightCm, weightKg, gender, age, activityLevel, goal, targetWeightKg ?? null, waterGoalMl ?? 2500]
  );

  const result = await pool.query(
    `SELECT ${PROFILE_COLUMNS} FROM user_profiles WHERE user_id = $1`,
    [req.userId]
  );
  res.json(toProfileResponse(result.rows[0]));
}));

// MacroFactor-style adaptive target: instead of trusting the TDEE formula
// blindly, compare the user's actual observed weight trend (from weigh-ins)
// against what their goal expects, and nudge the target off their own
// average intake rather than the formula estimate. Needs at least 2
// weigh-ins spanning 10+ days to be worth trusting — otherwise falls back
// to the static formula target.
profileRouter.get("/adaptive-target", asyncHandler(async (req, res) => {
  const profileResult = await pool.query(
    `SELECT ${PROFILE_COLUMNS} FROM user_profiles WHERE user_id = $1`,
    [req.userId]
  );
  if (profileResult.rows.length === 0) {
    res.status(404).json({ error: "No profile yet" });
    return;
  }
  const row = profileResult.rows[0];
  const profile = toProfileResponse(row);

  const weightsResult = await pool.query(
    `SELECT weight_kg, logged_at FROM weight_logs
     WHERE user_id = $1 AND logged_at >= now() - interval '21 days'
     ORDER BY logged_at ASC`,
    [req.userId]
  );
  const weights = weightsResult.rows;

  const daysSpan =
    weights.length >= 2
      ? (new Date(weights[weights.length - 1].logged_at).getTime() - new Date(weights[0].logged_at).getTime()) /
        86_400_000
      : 0;

  if (weights.length < 2 || daysSpan < 10) {
    res.json({ available: false, calorieTarget: profile.calorieTarget });
    return;
  }

  // Least-squares slope (kg/day) over the weigh-ins, smoother than a naive
  // first-vs-last diff which is noisy against daily water-weight swings.
  const t0 = new Date(weights[0].logged_at).getTime();
  const xs = weights.map((w) => (new Date(w.logged_at).getTime() - t0) / 86_400_000);
  const ys = weights.map((w) => Number(w.weight_kg));
  const n = xs.length;
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0);
  const sumXX = xs.reduce((s, x) => s + x * x, 0);
  const denom = n * sumXX - sumX * sumX;
  const slopePerDay = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
  const actualWeeklyRateKg = slopePerDay * 7;

  const dailyCaloriesResult = await pool.query(
    `SELECT l.logged_at::date AS date, SUM(f.calories_per_100g * l.quantity_grams / 100) AS calories
     FROM food_logs l JOIN foods f ON f.id = l.food_id
     WHERE l.user_id = $1 AND l.logged_at >= $2
     GROUP BY l.logged_at::date`,
    [req.userId, weights[0].logged_at]
  );
  const avgCalories =
    dailyCaloriesResult.rows.length > 0
      ? dailyCaloriesResult.rows.reduce((s, r) => s + Number(r.calories), 0) / dailyCaloriesResult.rows.length
      : profile.calorieTarget;

  const weightKg = Number(row.weight_kg);
  const expectedRateKg = expectedWeeklyRateKg(weightKg, row.goal as Goal);
  const deltaKgPerWeek = expectedRateKg - actualWeeklyRateKg;
  // ~7700 kcal per kg of bodyweight; clamp so one noisy week can't swing the
  // target wildly, and never suggest below a 1200 kcal safety floor.
  const adjustmentPerDay = Math.max(-500, Math.min(500, deltaKgPerWeek * 1100));
  const adaptiveTarget = Math.max(1200, Math.round(avgCalories + adjustmentPerDay));

  res.json({
    available: true,
    calorieTarget: adaptiveTarget,
    baseTarget: profile.calorieTarget,
    avgCalories: Math.round(avgCalories),
    actualWeeklyRateKg: Math.round(actualWeeklyRateKg * 100) / 100,
    expectedWeeklyRateKg: Math.round(expectedRateKg * 100) / 100,
    daysOfData: Math.round(daysSpan),
  });
}));
