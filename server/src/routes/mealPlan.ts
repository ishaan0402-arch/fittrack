import { Router } from "express";
import { pool } from "../db.js";
import { asyncHandler } from "../asyncHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { ensureNutrientsCached } from "./logs.js";
import type { MealType } from "../dateUtils.js";

export const mealPlanRouter = Router();
mealPlanRouter.use(requireAuth);

const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// All planned entries in a date range, for the weekly planner view.
// Registered before "/:id"-shaped routes for the same reason as the rest
// of this codebase's fixed-segment-before-catch-all convention.
mealPlanRouter.get("/range", asyncHandler(async (req, res) => {
  const { start, end } = req.query as { start?: string; end?: string };
  if (!start || !end || !DATE_RE.test(start) || !DATE_RE.test(end)) {
    res.status(400).json({ error: "start and end (YYYY-MM-DD) are required" });
    return;
  }

  const result = await pool.query(
    `SELECT mp.id, mp.date::text AS date, mp.meal_type, mp.food_id, mp.quantity_grams,
            f.description, ROUND(f.calories_per_100g * mp.quantity_grams / 100, 1) AS calories
     FROM meal_plan_entries mp
     JOIN foods f ON f.id = mp.food_id
     WHERE mp.user_id = $1 AND mp.date BETWEEN $2::date AND $3::date
     ORDER BY mp.date, mp.meal_type, mp.id`,
    [req.userId, start, end]
  );
  res.json(result.rows);
}));

// Aggregated shopping list across a date range — every planned food's total
// quantity summed, regardless of which day/meal it's assigned to.
mealPlanRouter.get("/grocery-list", asyncHandler(async (req, res) => {
  const { start, end } = req.query as { start?: string; end?: string };
  if (!start || !end || !DATE_RE.test(start) || !DATE_RE.test(end)) {
    res.status(400).json({ error: "start and end (YYYY-MM-DD) are required" });
    return;
  }

  const result = await pool.query(
    `SELECT mp.food_id, f.description, SUM(mp.quantity_grams) AS total_quantity_grams
     FROM meal_plan_entries mp
     JOIN foods f ON f.id = mp.food_id
     WHERE mp.user_id = $1 AND mp.date BETWEEN $2::date AND $3::date
     GROUP BY mp.food_id, f.description
     ORDER BY f.description`,
    [req.userId, start, end]
  );
  res.json(result.rows);
}));

mealPlanRouter.post("/", asyncHandler(async (req, res) => {
  const { date, mealType, foodId, quantityGrams } = req.body as {
    date?: string;
    mealType?: string;
    foodId?: number;
    quantityGrams?: number;
  };

  if (!date || !DATE_RE.test(date)) {
    res.status(400).json({ error: "date must be YYYY-MM-DD" });
    return;
  }
  if (mealType && !MEAL_TYPES.includes(mealType as MealType)) {
    res.status(400).json({ error: `mealType must be one of ${MEAL_TYPES.join(", ")}` });
    return;
  }
  if (!foodId || !quantityGrams || quantityGrams <= 0) {
    res.status(400).json({ error: "foodId and a positive quantityGrams are required" });
    return;
  }

  const result = await pool.query(
    `INSERT INTO meal_plan_entries (user_id, date, meal_type, food_id, quantity_grams)
     VALUES ($1, $2::date, $3, $4, $5)
     RETURNING id, date::text AS date, meal_type, food_id, quantity_grams`,
    [req.userId, date, mealType || "snack", foodId, quantityGrams]
  );
  res.status(201).json(result.rows[0]);
}));

// Adds every item from a saved meal onto one planned date/meal-type in one
// action — the planning-side equivalent of meals.ts's "/:id/log".
mealPlanRouter.post("/add-meal", asyncHandler(async (req, res) => {
  const { date, mealType, mealId } = req.body as { date?: string; mealType?: string; mealId?: number };

  if (!date || !DATE_RE.test(date)) {
    res.status(400).json({ error: "date must be YYYY-MM-DD" });
    return;
  }
  if (mealType && !MEAL_TYPES.includes(mealType as MealType)) {
    res.status(400).json({ error: `mealType must be one of ${MEAL_TYPES.join(", ")}` });
    return;
  }
  if (!mealId) {
    res.status(400).json({ error: "mealId is required" });
    return;
  }

  const meal = await pool.query("SELECT id FROM meals WHERE id = $1 AND user_id = $2", [mealId, req.userId]);
  if (meal.rows.length === 0) {
    res.status(404).json({ error: "Meal not found" });
    return;
  }

  const items = await pool.query(
    "SELECT food_id, quantity_grams FROM meal_items WHERE meal_id = $1",
    [mealId]
  );

  const inserted = [];
  for (const item of items.rows) {
    const result = await pool.query(
      `INSERT INTO meal_plan_entries (user_id, date, meal_type, food_id, quantity_grams)
       VALUES ($1, $2::date, $3, $4, $5)
       RETURNING id, date::text AS date, meal_type, food_id, quantity_grams`,
      [req.userId, date, mealType || "snack", item.food_id, item.quantity_grams]
    );
    inserted.push(result.rows[0]);
  }
  res.status(201).json(inserted);
}));

// Moves a planned entry into today's/that day's actual food log — the
// point of planning in the first place is to log it once the day comes.
mealPlanRouter.post("/:id/log", asyncHandler(async (req, res) => {
  const entry = await pool.query(
    `SELECT mp.date, mp.meal_type, mp.food_id, mp.quantity_grams, f.fdc_id
     FROM meal_plan_entries mp
     JOIN foods f ON f.id = mp.food_id
     WHERE mp.id = $1 AND mp.user_id = $2`,
    [req.params.id, req.userId]
  );
  if (entry.rows.length === 0) {
    res.status(404).json({ error: "Planned entry not found" });
    return;
  }
  const row = entry.rows[0];

  await ensureNutrientsCached(row.food_id, row.fdc_id);

  const logged = await pool.query(
    `INSERT INTO food_logs (user_id, food_id, quantity_grams, meal_type, logged_at)
     VALUES ($1, $2, $3, $4, $5::date)
     RETURNING id, food_id, quantity_grams, note, meal_type, logged_at`,
    [req.userId, row.food_id, row.quantity_grams, row.meal_type, row.date]
  );

  await pool.query("DELETE FROM meal_plan_entries WHERE id = $1", [req.params.id]);

  res.status(201).json(logged.rows[0]);
}));

mealPlanRouter.delete("/:id", asyncHandler(async (req, res) => {
  const result = await pool.query(
    "DELETE FROM meal_plan_entries WHERE id = $1 AND user_id = $2 RETURNING id",
    [req.params.id, req.userId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: "Planned entry not found" });
    return;
  }
  res.status(204).end();
}));
