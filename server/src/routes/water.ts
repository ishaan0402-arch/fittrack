import { Router } from "express";
import { pool } from "../db.js";
import { asyncHandler } from "../asyncHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { localDateString } from "../dateUtils.js";

export const waterRouter = Router();
waterRouter.use(requireAuth);

waterRouter.get("/today", asyncHandler(async (req, res) => {
  const today = localDateString();

  const [entriesResult, profileResult] = await Promise.all([
    pool.query(
      `SELECT id, amount_ml, logged_at FROM water_logs
       WHERE user_id = $1 AND logged_at::date = $2::date
       ORDER BY logged_at ASC`,
      [req.userId, today]
    ),
    pool.query("SELECT water_goal_ml FROM user_profiles WHERE user_id = $1", [req.userId]),
  ]);

  const totalMl = entriesResult.rows.reduce((sum, row) => sum + row.amount_ml, 0);

  res.json({
    entries: entriesResult.rows,
    totalMl,
    goalMl: profileResult.rows[0]?.water_goal_ml ?? 2500,
  });
}));

waterRouter.post("/", asyncHandler(async (req, res) => {
  const { amountMl } = req.body as { amountMl?: number };
  if (!amountMl || amountMl <= 0) {
    res.status(400).json({ error: "A positive amountMl is required" });
    return;
  }

  const result = await pool.query(
    "INSERT INTO water_logs (user_id, amount_ml) VALUES ($1, $2) RETURNING id, amount_ml, logged_at",
    [req.userId, amountMl]
  );
  res.status(201).json(result.rows[0]);
}));

waterRouter.delete("/:id", asyncHandler(async (req, res) => {
  const result = await pool.query(
    "DELETE FROM water_logs WHERE id = $1 AND user_id = $2 RETURNING id",
    [req.params.id, req.userId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: "Entry not found" });
    return;
  }
  res.status(204).end();
}));
