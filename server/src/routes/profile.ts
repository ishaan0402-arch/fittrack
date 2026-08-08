import { Router } from "express";
import { pool } from "../db.js";
import { asyncHandler } from "../asyncHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";
import {
  ACTIVITY_MULTIPLIERS,
  estimateExpenditure,
  calorieTargetForGoal,
  macroTargetsForGoal,
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
