import { Router } from "express";
import { pool } from "../db.js";
import { asyncHandler } from "../asyncHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";

export const recipesRouter = Router();
recipesRouter.use(requireAuth);

// Recipes double as loggable foods (each has a food_id) — this shape is
// Food-compatible so the frontend can feed the list straight into
// FoodPickerList for one-tap logging, same as custom foods.
// Shaped so this is directly Food-compatible (id = the loggable food's id) —
// the frontend feeds this straight into FoodPickerList for one-tap logging,
// same as custom foods. recipe_id is included separately for delete/detail.
recipesRouter.get("/", asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT f.id, r.id AS recipe_id, r.servings, f.description, f.calories_per_100g,
       f.protein_per_100g, f.carbs_per_100g, f.fat_per_100g, f.serving_size_grams
     FROM recipes r
     JOIN foods f ON f.id = r.food_id
     WHERE r.user_id = $1
     ORDER BY r.created_at DESC`,
    [req.userId]
  );
  res.json(result.rows);
}));

recipesRouter.get("/:id", asyncHandler(async (req, res) => {
  const recipe = await pool.query(
    `SELECT r.id, r.servings, f.description, f.serving_size_grams
     FROM recipes r JOIN foods f ON f.id = r.food_id
     WHERE r.id = $1 AND r.user_id = $2`,
    [req.params.id, req.userId]
  );
  if (recipe.rows.length === 0) {
    res.status(404).json({ error: "Recipe not found" });
    return;
  }

  const items = await pool.query(
    `SELECT ri.id, ri.food_id, ri.quantity_grams, f.description
     FROM recipe_items ri
     JOIN foods f ON f.id = ri.food_id
     WHERE ri.recipe_id = $1
     ORDER BY ri.id`,
    [req.params.id]
  );

  res.json({ ...recipe.rows[0], items: items.rows });
}));

recipesRouter.post("/", asyncHandler(async (req, res) => {
  const { name, servings, ingredients } = req.body as {
    name?: string;
    servings?: number;
    ingredients?: { foodId: number; quantityGrams: number }[];
  };

  if (!name?.trim() || !servings || servings <= 0 || !Array.isArray(ingredients) || ingredients.length === 0) {
    res.status(400).json({ error: "name, a positive servings, and at least one ingredient are required" });
    return;
  }
  if (ingredients.some((i) => !i.foodId || !i.quantityGrams || i.quantityGrams <= 0)) {
    res.status(400).json({ error: "Every ingredient needs a foodId and a positive quantityGrams" });
    return;
  }

  const foodRows = await pool.query(
    `SELECT id, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g
     FROM foods WHERE id = ANY($1::int[])`,
    [ingredients.map((i) => i.foodId)]
  );
  const foodById = new Map(foodRows.rows.map((f) => [f.id, f]));
  if (foodById.size !== new Set(ingredients.map((i) => i.foodId)).size) {
    res.status(404).json({ error: "One or more ingredients weren't found" });
    return;
  }

  // Aggregate nutrition scales per-100g values by each ingredient's grams,
  // then re-expresses the total per 100g of the combined dish — the same
  // math a nutrition label uses, so the resulting food behaves exactly
  // like any other (log any quantity of it, not just whole servings).
  let totalGrams = 0;
  let calories = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  for (const ing of ingredients) {
    const food = foodById.get(ing.foodId)!;
    const scale = ing.quantityGrams / 100;
    totalGrams += ing.quantityGrams;
    calories += Number(food.calories_per_100g) * scale;
    protein += food.protein_per_100g != null ? Number(food.protein_per_100g) * scale : 0;
    carbs += food.carbs_per_100g != null ? Number(food.carbs_per_100g) * scale : 0;
    fat += food.fat_per_100g != null ? Number(food.fat_per_100g) * scale : 0;
  }

  const servingSizeGrams = totalGrams / servings;
  const per100Scale = 100 / totalGrams;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const food = await client.query(
      `INSERT INTO foods (description, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, serving_size_grams, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, description, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, serving_size_grams`,
      [
        name.trim(),
        calories * per100Scale,
        protein * per100Scale,
        carbs * per100Scale,
        fat * per100Scale,
        servingSizeGrams,
        req.userId,
      ]
    );
    const foodId = food.rows[0].id;

    const recipe = await client.query(
      "INSERT INTO recipes (user_id, food_id, servings) VALUES ($1, $2, $3) RETURNING id, servings",
      [req.userId, foodId, servings]
    );

    for (const ing of ingredients) {
      await client.query(
        "INSERT INTO recipe_items (recipe_id, food_id, quantity_grams) VALUES ($1, $2, $3)",
        [recipe.rows[0].id, ing.foodId, ing.quantityGrams]
      );
    }

    await client.query("COMMIT");
    res.status(201).json({ ...recipe.rows[0], ...food.rows[0], food_id: foodId });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}));

recipesRouter.delete("/:id", asyncHandler(async (req, res) => {
  const recipe = await pool.query(
    "DELETE FROM recipes WHERE id = $1 AND user_id = $2 RETURNING food_id",
    [req.params.id, req.userId]
  );
  if (recipe.rows.length === 0) {
    res.status(404).json({ error: "Recipe not found" });
    return;
  }

  // Best-effort — leave the food row behind if it's already been logged
  // (same pattern as everywhere else custom foods get cleaned up).
  await pool.query("DELETE FROM foods WHERE id = $1", [recipe.rows[0].food_id]).catch(() => {});
  res.status(204).end();
}));
