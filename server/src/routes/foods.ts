import { Router } from "express";
import { pool } from "../db.js";
import { searchUsdaFoods } from "../usda.js";
import { asyncHandler } from "../asyncHandler.js";

export const foodsRouter = Router();

foodsRouter.get("/search", asyncHandler(async (req, res) => {
  const query = String(req.query.q ?? "").trim();
  if (!query) {
    res.status(400).json({ error: "Query param 'q' is required" });
    return;
  }

  const cached = await pool.query(
    `SELECT id, fdc_id, description, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g
     FROM foods WHERE description ILIKE $1 LIMIT 10`,
    [`%${query}%`]
  );

  if (cached.rows.length > 0) {
    res.json(cached.rows);
    return;
  }

  const usdaResults = await searchUsdaFoods(query);
  if (usdaResults.length === 0) {
    res.json([]);
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

  res.json(inserted.map((r) => r.rows[0]));
}));
