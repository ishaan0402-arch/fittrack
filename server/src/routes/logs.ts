import { Router } from "express";
import { pool } from "../db.js";
import { asyncHandler } from "../asyncHandler.js";
import { fetchUsdaFoodDetail } from "../usda.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { localDateString, defaultMealType, type MealType } from "../dateUtils.js";

const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

export const logsRouter = Router();
logsRouter.use(requireAuth);

// Nutrient detail is fetched from USDA lazily, the first time a food is
// actually logged (not at search time) — most search results never get added.
export async function ensureNutrientsCached(foodId: number, fdcId: number | null) {
  if (fdcId == null) return; // custom foods have no USDA detail to fetch

  const existing = await pool.query("SELECT 1 FROM food_nutrients WHERE food_id = $1 LIMIT 1", [
    foodId,
  ]);
  if (existing.rows.length > 0) return;

  // Some foods that appear in USDA search results 404 on their own detail
  // endpoint (a USDA-side inconsistency, seen on newer Foundation entries).
  // That's a missing "nice to have" — it must never block logging the food.
  let nutrients;
  try {
    nutrients = await fetchUsdaFoodDetail(fdcId);
  } catch (err) {
    console.warn(`Nutrient detail fetch failed for fdcId ${fdcId}:`, (err as Error).message);
    return;
  }
  if (nutrients.length === 0) return;

  const values = nutrients
    .map(
      (_, i) =>
        `($1, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4}, $${i * 4 + 5})`
    )
    .join(", ");
  const params = nutrients.flatMap((n) => [n.nutrientId, n.name, n.unit, n.amountPer100g]);

  await pool.query(
    `INSERT INTO food_nutrients (food_id, nutrient_id, name, unit, amount_per_100g)
     VALUES ${values}
     ON CONFLICT (food_id, nutrient_id) DO NOTHING`,
    [foodId, ...params]
  );
}

logsRouter.post("/", asyncHandler(async (req, res) => {
  const { foodId, quantityGrams, note, mealType } = req.body as {
    foodId?: number;
    quantityGrams?: number;
    note?: string;
    mealType?: string;
  };

  if (!foodId || !quantityGrams || quantityGrams <= 0) {
    res.status(400).json({ error: "foodId and a positive quantityGrams are required" });
    return;
  }
  if (mealType && !MEAL_TYPES.includes(mealType as MealType)) {
    res.status(400).json({ error: `mealType must be one of ${MEAL_TYPES.join(", ")}` });
    return;
  }

  const food = await pool.query("SELECT fdc_id FROM foods WHERE id = $1", [foodId]);
  if (food.rows.length === 0) {
    res.status(404).json({ error: "Food not found" });
    return;
  }

  await ensureNutrientsCached(foodId, food.rows[0].fdc_id);

  const result = await pool.query(
    `INSERT INTO food_logs (user_id, food_id, quantity_grams, note, meal_type)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, food_id, quantity_grams, note, meal_type, logged_at`,
    [req.userId, foodId, quantityGrams, note?.trim() || null, mealType ?? defaultMealType()]
  );

  res.status(201).json(result.rows[0]);
}));

logsRouter.patch("/:id", asyncHandler(async (req, res) => {
  const { quantityGrams, note, mealType } = req.body as {
    quantityGrams?: number;
    note?: string;
    mealType?: string;
  };

  if (!quantityGrams || quantityGrams <= 0) {
    res.status(400).json({ error: "A positive quantityGrams is required" });
    return;
  }
  if (mealType && !MEAL_TYPES.includes(mealType as MealType)) {
    res.status(400).json({ error: `mealType must be one of ${MEAL_TYPES.join(", ")}` });
    return;
  }

  const result = await pool.query(
    `UPDATE food_logs SET quantity_grams = $1, note = $2, meal_type = COALESCE($3, meal_type)
     WHERE id = $4 AND user_id = $5
     RETURNING id, food_id, quantity_grams, note, meal_type, logged_at`,
    [quantityGrams, note?.trim() || null, mealType ?? null, req.params.id, req.userId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: "Log entry not found" });
    return;
  }
  res.json(result.rows[0]);
}));

logsRouter.delete("/:id", asyncHandler(async (req, res) => {
  const result = await pool.query(
    "DELETE FROM food_logs WHERE id = $1 AND user_id = $2 RETURNING id",
    [req.params.id, req.userId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: "Log entry not found" });
    return;
  }
  res.status(204).end();
}));

logsRouter.get("/", asyncHandler(async (req, res) => {
  const date = String(req.query.date ?? localDateString());

  const entriesResult = await pool.query(
    `SELECT
       l.id,
       l.quantity_grams,
       l.note,
       l.meal_type,
       l.logged_at,
       f.id AS food_id,
       f.description,
       ROUND(f.calories_per_100g * l.quantity_grams / 100, 1) AS calories,
       ROUND(f.protein_per_100g * l.quantity_grams / 100, 1) AS protein,
       ROUND(f.carbs_per_100g * l.quantity_grams / 100, 1) AS carbs,
       ROUND(f.fat_per_100g * l.quantity_grams / 100, 1) AS fat
     FROM food_logs l
     JOIN foods f ON f.id = l.food_id
     WHERE l.user_id = $1 AND l.logged_at::date = $2::date
     ORDER BY l.logged_at ASC`,
    [req.userId, date]
  );

  const round1 = (n: number) => Math.round(n * 10) / 10;
  const sumColumn = (column: "calories" | "protein" | "carbs" | "fat") =>
    round1(entriesResult.rows.reduce((sum, row) => sum + Number(row[column] ?? 0), 0));

  const nutrientsResult = await pool.query(
    `SELECT
       fn.nutrient_id,
       fn.name,
       fn.unit,
       ROUND(SUM(fn.amount_per_100g * l.quantity_grams / 100), 2) AS amount
     FROM food_logs l
     JOIN food_nutrients fn ON fn.food_id = l.food_id
     WHERE l.user_id = $1 AND l.logged_at::date = $2::date
     GROUP BY fn.nutrient_id, fn.name, fn.unit
     ORDER BY fn.nutrient_id`,
    [req.userId, date]
  );

  res.json({
    date,
    entries: entriesResult.rows,
    totals: {
      calories: sumColumn("calories"),
      protein: sumColumn("protein"),
      carbs: sumColumn("carbs"),
      fat: sumColumn("fat"),
    },
    nutrients: nutrientsResult.rows,
  });
}));

// Daily calorie totals for the Dashboard trend chart — one row per calendar
// day in the range, zero-filled for days with nothing logged.
logsRouter.get("/history", asyncHandler(async (req, res) => {
  const days = Math.min(Number(req.query.days) || 14, 365);

  const result = await pool.query(
    `SELECT
       d::date::text AS date,
       COALESCE(ROUND(SUM(f.calories_per_100g * l.quantity_grams / 100), 1), 0) AS calories
     FROM generate_series(CURRENT_DATE - ($1::int - 1), CURRENT_DATE, interval '1 day') AS d
     LEFT JOIN food_logs l ON l.user_id = $2 AND l.logged_at::date = d::date
     LEFT JOIN foods f ON f.id = l.food_id
     GROUP BY d
     ORDER BY d`,
    [days, req.userId]
  );

  res.json(result.rows);
}));

// Current logging streak — consecutive calendar days (ending today or
// yesterday) with at least one food logged.
logsRouter.get("/streak", asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT DISTINCT logged_at::date::text AS day
     FROM food_logs
     WHERE user_id = $1
     ORDER BY day DESC
     LIMIT 400`,
    [req.userId]
  );

  const days: string[] = result.rows.map((r) => r.day);

  let streak = 0;
  let longestStreak = 0;
  if (days.length > 0) {
    const today = new Date(localDateString());
    const mostRecent = new Date(days[0]);
    const dayGap = Math.round((today.getTime() - mostRecent.getTime()) / 86_400_000);

    // Streak is only "current" if the most recent logged day is today or yesterday.
    if (dayGap <= 1) {
      streak = 1;
      for (let i = 1; i < days.length; i++) {
        const prev = new Date(days[i - 1]);
        const cur = new Date(days[i]);
        const gap = Math.round((prev.getTime() - cur.getTime()) / 86_400_000);
        if (gap === 1) {
          streak++;
        } else {
          break;
        }
      }
    }

    // Longest streak ever, over the same (up to 400-day) window — a bit of
    // positive reinforcement even on days the current streak has reset.
    let running = 1;
    longestStreak = 1;
    for (let i = 1; i < days.length; i++) {
      const prev = new Date(days[i - 1]);
      const cur = new Date(days[i]);
      const gap = Math.round((prev.getTime() - cur.getTime()) / 86_400_000);
      running = gap === 1 ? running + 1 : 1;
      longestStreak = Math.max(longestStreak, running);
    }
  }

  res.json({ streak, longestStreak });
}));
