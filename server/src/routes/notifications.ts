import { Router } from "express";
import { pool } from "../db.js";
import { asyncHandler } from "../asyncHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { localDateString } from "../dateUtils.js";
import {
  estimateExpenditure,
  calorieTargetForGoal,
  macroTargetsForGoal,
  type ActivityLevel,
  type Gender,
  type Goal,
} from "../expenditure.js";

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

const WEIGH_IN_REMINDER_DAYS = 7;

notificationsRouter.get("/", asyncHandler(async (req, res) => {
  const today = localDateString();
  const notifications: { id: string; message: string }[] = [];

  const workoutToday = await pool.query(
    "SELECT 1 FROM workouts WHERE user_id = $1 AND date = $2::date",
    [req.userId, today]
  );
  if (workoutToday.rows.length === 0) {
    notifications.push({ id: "workout-today", message: "You haven't logged a workout today." });
  }

  const profileResult = await pool.query(
    "SELECT height_cm, weight_kg, gender, age, activity_level, goal FROM user_profiles WHERE user_id = $1",
    [req.userId]
  );
  if (profileResult.rows.length > 0) {
    const p = profileResult.rows[0];
    const weightKg = Number(p.weight_kg);
    const expenditure = estimateExpenditure({
      heightCm: Number(p.height_cm),
      weightKg,
      age: p.age,
      gender: p.gender as Gender,
      activityLevel: p.activity_level as ActivityLevel,
    });
    const calorieTarget = calorieTargetForGoal(expenditure, p.goal as Goal);
    const proteinTarget = macroTargetsForGoal(weightKg, p.goal as Goal, calorieTarget).protein;

    const proteinResult = await pool.query(
      `SELECT COALESCE(SUM(f.protein_per_100g * l.quantity_grams / 100), 0) AS protein
       FROM food_logs l
       JOIN foods f ON f.id = l.food_id
       WHERE l.user_id = $1 AND l.logged_at::date = $2::date`,
      [req.userId, today]
    );
    const proteinConsumed = Number(proteinResult.rows[0].protein);

    if (proteinTarget > 0) {
      const ratio = proteinConsumed / proteinTarget;
      if (ratio >= 1) {
        notifications.push({
          id: "protein-goal",
          message: `Protein goal reached — ${Math.round(proteinConsumed)}g / ${proteinTarget}g today.`,
        });
      } else if (ratio >= 0.8) {
        notifications.push({
          id: "protein-goal",
          message: `Protein goal almost reached — ${Math.round(proteinTarget - proteinConsumed)}g to go.`,
        });
      }
    }
  }

  const lastWeighIn = await pool.query(
    "SELECT logged_at::date::text AS date FROM weight_logs WHERE user_id = $1 ORDER BY logged_at DESC LIMIT 1",
    [req.userId]
  );
  if (lastWeighIn.rows.length === 0) {
    notifications.push({ id: "weigh-in", message: "Time to weigh yourself — you haven't logged a weight yet." });
  } else {
    const daysSince = Math.round(
      (new Date(today).getTime() - new Date(lastWeighIn.rows[0].date).getTime()) / 86_400_000
    );
    if (daysSince >= WEIGH_IN_REMINDER_DAYS) {
      notifications.push({
        id: "weigh-in",
        message: `Time to weigh yourself — it's been ${daysSince} days since your last check-in.`,
      });
    }
  }

  res.json(notifications);
}));
