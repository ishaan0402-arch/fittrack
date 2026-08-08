import { Router } from "express";
import { pool } from "../db.js";
import { asyncHandler } from "../asyncHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";

export const exportRouter = Router();
exportRouter.use(requireAuth);

function csvEscape(value: unknown): string {
  const s = value == null ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const header = columns.join(",");
  const lines = rows.map((row) => columns.map((col) => csvEscape(row[col])).join(","));
  return [header, ...lines].join("\n");
}

// Plain <a href download> links hit these directly (see Settings), so the
// browser sends the auth cookie automatically — no separate token needed.
exportRouter.get("/food-log.csv", asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT l.logged_at, l.meal_type, f.description, l.quantity_grams, l.note,
            ROUND(f.calories_per_100g * l.quantity_grams / 100, 1) AS calories,
            ROUND(f.protein_per_100g * l.quantity_grams / 100, 1) AS protein_g,
            ROUND(f.carbs_per_100g * l.quantity_grams / 100, 1) AS carbs_g,
            ROUND(f.fat_per_100g * l.quantity_grams / 100, 1) AS fat_g
     FROM food_logs l
     JOIN foods f ON f.id = l.food_id
     WHERE l.user_id = $1
     ORDER BY l.logged_at ASC`,
    [req.userId]
  );

  const csv = toCsv(result.rows, [
    "logged_at",
    "meal_type",
    "description",
    "quantity_grams",
    "note",
    "calories",
    "protein_g",
    "carbs_g",
    "fat_g",
  ]);

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="fittrack-food-log.csv"');
  res.send(csv);
}));

exportRouter.get("/weight-history.csv", asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT logged_at, weight_kg FROM weight_logs WHERE user_id = $1 ORDER BY logged_at ASC`,
    [req.userId]
  );

  const csv = toCsv(result.rows, ["logged_at", "weight_kg"]);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="fittrack-weight-history.csv"');
  res.send(csv);
}));
