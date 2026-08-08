import { Router } from "express";
import { pool } from "../db.js";
import { asyncHandler } from "../asyncHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { ensureNutrientsCached } from "./logs.js";
import { defaultMealType, type MealType } from "../dateUtils.js";

const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

export const mealsRouter = Router();
mealsRouter.use(requireAuth);

// Saved meals with their total calories and item count, for the Meals list.
mealsRouter.get("/", asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT
       m.id, m.name, m.created_at,
       COUNT(mi.id) AS item_count,
       COALESCE(ROUND(SUM(f.calories_per_100g * mi.quantity_grams / 100), 1), 0) AS calories
     FROM meals m
     LEFT JOIN meal_items mi ON mi.meal_id = m.id
     LEFT JOIN foods f ON f.id = mi.food_id
     WHERE m.user_id = $1
     GROUP BY m.id
     ORDER BY m.created_at DESC`,
    [req.userId]
  );

  res.json(result.rows);
}));

// A single meal's items, for the meal detail / edit view.
mealsRouter.get("/:id", asyncHandler(async (req, res) => {
  const meal = await pool.query("SELECT id, name, created_at FROM meals WHERE id = $1 AND user_id = $2", [
    req.params.id,
    req.userId,
  ]);
  if (meal.rows.length === 0) {
    res.status(404).json({ error: "Meal not found" });
    return;
  }

  const items = await pool.query(
    `SELECT mi.id, mi.food_id, mi.quantity_grams, f.description,
       ROUND(f.calories_per_100g * mi.quantity_grams / 100, 1) AS calories
     FROM meal_items mi
     JOIN foods f ON f.id = mi.food_id
     WHERE mi.meal_id = $1
     ORDER BY mi.id`,
    [req.params.id]
  );

  res.json({ ...meal.rows[0], items: items.rows });
}));

mealsRouter.post("/", asyncHandler(async (req, res) => {
  const { name, items } = req.body as {
    name?: string;
    items?: { foodId: number; quantityGrams: number }[];
  };

  if (!name?.trim() || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "name and at least one item are required" });
    return;
  }
  if (items.some((item) => !item.foodId || !item.quantityGrams || item.quantityGrams <= 0)) {
    res.status(400).json({ error: "Every item needs a foodId and a positive quantityGrams" });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const meal = await client.query(
      "INSERT INTO meals (user_id, name) VALUES ($1, $2) RETURNING id, name, created_at",
      [req.userId, name.trim()]
    );
    const mealId = meal.rows[0].id;

    for (const item of items) {
      await client.query(
        "INSERT INTO meal_items (meal_id, food_id, quantity_grams) VALUES ($1, $2, $3)",
        [mealId, item.foodId, item.quantityGrams]
      );
    }

    await client.query("COMMIT");
    res.status(201).json(meal.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}));

mealsRouter.delete("/:id", asyncHandler(async (req, res) => {
  const result = await pool.query("DELETE FROM meals WHERE id = $1 AND user_id = $2 RETURNING id", [
    req.params.id,
    req.userId,
  ]);
  if (result.rows.length === 0) {
    res.status(404).json({ error: "Meal not found" });
    return;
  }
  res.status(204).end();
}));

// Logs every item in the meal as a separate food_log entry in one action —
// the whole point of saving a meal in the first place.
mealsRouter.post("/:id/log", asyncHandler(async (req, res) => {
  const { mealType } = req.body as { mealType?: string };
  if (mealType && !MEAL_TYPES.includes(mealType as MealType)) {
    res.status(400).json({ error: `mealType must be one of ${MEAL_TYPES.join(", ")}` });
    return;
  }

  const meal = await pool.query("SELECT id FROM meals WHERE id = $1 AND user_id = $2", [
    req.params.id,
    req.userId,
  ]);
  if (meal.rows.length === 0) {
    res.status(404).json({ error: "Meal not found" });
    return;
  }

  const items = await pool.query(
    `SELECT mi.food_id, mi.quantity_grams, f.fdc_id
     FROM meal_items mi
     JOIN foods f ON f.id = mi.food_id
     WHERE mi.meal_id = $1`,
    [req.params.id]
  );

  const resolvedMealType = mealType ?? defaultMealType();
  const logged = [];
  for (const item of items.rows) {
    await ensureNutrientsCached(item.food_id, item.fdc_id);
    const result = await pool.query(
      `INSERT INTO food_logs (user_id, food_id, quantity_grams, note, meal_type)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, food_id, quantity_grams, note, meal_type, logged_at`,
      [req.userId, item.food_id, item.quantity_grams, null, resolvedMealType]
    );
    logged.push(result.rows[0]);
  }

  res.status(201).json(logged);
}));
