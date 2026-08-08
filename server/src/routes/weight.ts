import { Router } from "express";
import { pool } from "../db.js";
import { asyncHandler } from "../asyncHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";

export const weightRouter = Router();
weightRouter.use(requireAuth);

weightRouter.post("/", asyncHandler(async (req, res) => {
  const { weightKg } = req.body as { weightKg?: number };
  if (!weightKg || weightKg <= 0) {
    res.status(400).json({ error: "A positive weightKg is required" });
    return;
  }

  const result = await pool.query(
    `INSERT INTO weight_logs (user_id, weight_kg) VALUES ($1, $2)
     RETURNING id, weight_kg, logged_at`,
    [req.userId, weightKg]
  );

  res.status(201).json(result.rows[0]);
}));

weightRouter.get("/", asyncHandler(async (req, res) => {
  const days = Math.min(Number(req.query.days) || 30, 365);

  const result = await pool.query(
    `SELECT id, weight_kg, logged_at
     FROM weight_logs
     WHERE user_id = $1 AND logged_at >= now() - ($2 || ' days')::interval
     ORDER BY logged_at ASC`,
    [req.userId, days]
  );

  res.json(result.rows);
}));
