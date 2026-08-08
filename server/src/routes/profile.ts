import { Router } from "express";
import { pool } from "../db.js";
import { asyncHandler } from "../asyncHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { ACTIVITY_MULTIPLIERS, estimateExpenditure, type ActivityLevel, type Gender } from "../expenditure.js";

export const profileRouter = Router();
profileRouter.use(requireAuth);

function toProfileResponse(row: {
  height_cm: string;
  weight_kg: string;
  gender: Gender;
  age: number;
  activity_level: ActivityLevel;
}) {
  const heightCm = Number(row.height_cm);
  const weightKg = Number(row.weight_kg);
  return {
    heightCm,
    weightKg,
    gender: row.gender,
    age: row.age,
    activityLevel: row.activity_level,
    expenditure: estimateExpenditure({
      heightCm,
      weightKg,
      age: row.age,
      gender: row.gender,
      activityLevel: row.activity_level,
    }),
  };
}

profileRouter.get("/", asyncHandler(async (req, res) => {
  const result = await pool.query(
    "SELECT height_cm, weight_kg, gender, age, activity_level FROM user_profiles WHERE user_id = $1",
    [req.userId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: "No profile yet" });
    return;
  }
  res.json(toProfileResponse(result.rows[0]));
}));

profileRouter.put("/", asyncHandler(async (req, res) => {
  const { heightCm, weightKg, gender, age, activityLevel } = req.body as {
    heightCm?: number;
    weightKg?: number;
    gender?: string;
    age?: number;
    activityLevel?: string;
  };

  if (
    !heightCm || heightCm <= 0 ||
    !weightKg || weightKg <= 0 ||
    !age || age <= 0 ||
    (gender !== "male" && gender !== "female") ||
    !activityLevel || !(activityLevel in ACTIVITY_MULTIPLIERS)
  ) {
    res.status(400).json({ error: "Invalid profile data" });
    return;
  }

  await pool.query(
    `INSERT INTO user_profiles (user_id, height_cm, weight_kg, gender, age, activity_level, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, now())
     ON CONFLICT (user_id) DO UPDATE SET
       height_cm = EXCLUDED.height_cm,
       weight_kg = EXCLUDED.weight_kg,
       gender = EXCLUDED.gender,
       age = EXCLUDED.age,
       activity_level = EXCLUDED.activity_level,
       updated_at = now()`,
    [req.userId, heightCm, weightKg, gender, age, activityLevel]
  );

  const result = await pool.query(
    "SELECT height_cm, weight_kg, gender, age, activity_level FROM user_profiles WHERE user_id = $1",
    [req.userId]
  );
  res.json(toProfileResponse(result.rows[0]));
}));
