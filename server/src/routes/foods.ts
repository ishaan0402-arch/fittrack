import { Router } from "express";
import { pool } from "../db.js";
import { searchUsdaFoods, searchUsdaByBarcode } from "../usda.js";
import { searchRestaurantMenu, nutritionixConfigured, type RestaurantMenuItem } from "../nutritionix.js";
import { asyncHandler } from "../asyncHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";

export const foodsRouter = Router();

// Foods this user has actually logged before, most recently used first —
// lets the Foods page offer one-tap re-logging instead of a fresh search.
foodsRouter.get("/recent", requireAuth, asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT
       f.id, f.fdc_id, f.description, f.calories_per_100g, f.serving_size_grams, f.restaurant_name,
       MAX(l.logged_at) AS last_logged_at,
       COUNT(*) AS times_logged,
       (ARRAY_AGG(l.quantity_grams ORDER BY l.logged_at DESC))[1] AS last_quantity_grams
     FROM food_logs l
     JOIN foods f ON f.id = l.food_id
     WHERE l.user_id = $1
     GROUP BY f.id, f.fdc_id, f.description, f.calories_per_100g, f.serving_size_grams, f.restaurant_name
     ORDER BY last_logged_at DESC
     LIMIT 20`,
    [req.userId]
  );

  res.json(result.rows);
}));

// Foods this user has created with their own calorie/macro values (fdc_id
// NULL, created_by_user_id set) — private to them, usable in the Diary,
// Foods page, and Meal builder just like any other food.
foodsRouter.get("/custom", requireAuth, asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT id, description, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, serving_size_grams
     FROM foods
     WHERE created_by_user_id = $1
     ORDER BY created_at DESC`,
    [req.userId]
  );

  res.json(result.rows);
}));

foodsRouter.post("/custom", requireAuth, asyncHandler(async (req, res) => {
  const { description, servingSizeGrams, calories, protein, carbs, fat } = req.body as {
    description?: string;
    servingSizeGrams?: number;
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
  };

  if (!description?.trim() || !servingSizeGrams || servingSizeGrams <= 0 || !calories || calories < 0) {
    res.status(400).json({
      error: "description, a positive servingSizeGrams, and non-negative calories are required",
    });
    return;
  }

  const scale = 100 / servingSizeGrams;
  const result = await pool.query(
    `INSERT INTO foods (description, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, serving_size_grams, created_by_user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, description, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, serving_size_grams`,
    [
      description.trim(),
      calories * scale,
      protein != null ? protein * scale : null,
      carbs != null ? carbs * scale : null,
      fat != null ? fat * scale : null,
      servingSizeGrams,
      req.userId,
    ]
  );

  res.status(201).json(result.rows[0]);
}));

// Looks up a scanned barcode against USDA's Branded dataset — cache-aside
// keyed on `barcode` so re-scanning the same product never re-hits the API.
foodsRouter.get("/barcode/:code", asyncHandler(async (req, res) => {
  const code = req.params.code.trim();
  if (!code) {
    res.status(400).json({ error: "Barcode is required" });
    return;
  }

  const cached = await pool.query(
    `SELECT id, fdc_id, description, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, serving_size_grams
     FROM foods WHERE barcode = $1`,
    [code]
  );
  if (cached.rows.length > 0) {
    res.json(cached.rows[0]);
    return;
  }

  const match = await searchUsdaByBarcode(code);
  if (!match) {
    res.status(404).json({ error: "No food found for that barcode" });
    return;
  }

  const inserted = await pool.query(
    `INSERT INTO foods (fdc_id, description, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, serving_size_grams, barcode)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (fdc_id) DO UPDATE SET barcode = EXCLUDED.barcode, description = EXCLUDED.description
     RETURNING id, fdc_id, description, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, serving_size_grams`,
    [
      match.fdcId,
      match.description,
      match.caloriesPer100g,
      match.proteinPer100g,
      match.carbsPer100g,
      match.fatPer100g,
      match.servingSizeGrams,
      code,
    ]
  );

  res.json(inserted.rows[0]);
}));

async function upsertRestaurantFood(item: RestaurantMenuItem) {
  const result = await pool.query(
    `INSERT INTO foods (description, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, serving_size_grams, restaurant_name, nix_item_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (nix_item_id) DO UPDATE SET description = EXCLUDED.description, calories_per_100g = EXCLUDED.calories_per_100g
     RETURNING id, fdc_id, description, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, serving_size_grams, restaurant_name`,
    [
      item.description,
      item.caloriesPer100g,
      item.proteinPer100g,
      item.carbsPer100g,
      item.fatPer100g,
      item.servingSizeGrams,
      item.restaurantName,
      item.nixItemId,
    ]
  );
  return result.rows[0];
}

foodsRouter.get("/search", asyncHandler(async (req, res) => {
  const query = String(req.query.q ?? "").trim();
  const restaurant = String(req.query.restaurant ?? "").trim();
  if (!query) {
    res.status(400).json({ error: "Query param 'q' is required" });
    return;
  }

  // When a restaurant is selected, search its actual published menu first —
  // this is the whole point of the restaurant picker. Degrades silently to
  // generic results if Nutritionix isn't configured yet or the call fails,
  // so a missing/broken API key never blocks search entirely.
  let restaurantResults: Awaited<ReturnType<typeof upsertRestaurantFood>>[] = [];
  if (restaurant && nutritionixConfigured()) {
    try {
      const menuItems = await searchRestaurantMenu(restaurant, query);
      restaurantResults = await Promise.all(menuItems.map(upsertRestaurantFood));
    } catch (err) {
      console.warn(`Nutritionix search failed for "${restaurant}":`, (err as Error).message);
    }
  }
  const restaurantIds = new Set(restaurantResults.map((r) => r.id));

  // created_by_user_id IS NULL excludes custom foods — those are private to
  // their creator and must never surface in this shared, unauthenticated
  // cache lookup.
  const cached = await pool.query(
    `SELECT id, fdc_id, description, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, serving_size_grams, restaurant_name
     FROM foods WHERE description ILIKE $1 AND created_by_user_id IS NULL LIMIT 10`,
    [`%${query}%`]
  );
  const dedupedCached = cached.rows.filter((r) => !restaurantIds.has(r.id));

  if (dedupedCached.length > 0) {
    res.json([...restaurantResults, ...dedupedCached]);
    return;
  }

  const usdaResults = await searchUsdaFoods(query);
  if (usdaResults.length === 0) {
    res.json(restaurantResults);
    return;
  }

  const inserted = await Promise.all(
    usdaResults.map((food) =>
      pool.query(
        `INSERT INTO foods (fdc_id, description, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (fdc_id) DO UPDATE SET description = EXCLUDED.description
         RETURNING id, fdc_id, description, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g`,
        [food.fdcId, food.description, food.caloriesPer100g, food.proteinPer100g, food.carbsPer100g, food.fatPer100g]
      )
    )
  );

  res.json([...restaurantResults, ...inserted.map((r) => r.rows[0])]);
}));
