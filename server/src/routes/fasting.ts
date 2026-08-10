import { Router } from "express";
import { pool } from "../db.js";
import { asyncHandler } from "../asyncHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";

export const fastingRouter = Router();
fastingRouter.use(requireAuth);

// The in-progress session (end_time IS NULL), if any — the client polls
// this to render the live elapsed-time countdown.
fastingRouter.get("/current", asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT id, goal_hours AS "goalHours", start_time AS "startTime", end_time AS "endTime"
     FROM fasting_sessions
     WHERE user_id = $1 AND end_time IS NULL
     ORDER BY start_time DESC
     LIMIT 1`,
    [req.userId]
  );
  res.json(result.rows[0] ?? null);
}));

// Recent completed sessions, for a short history list. Registered before
// "/:id"-shaped routes would go, though none exist yet — kept consistent
// with the rest of the codebase's route-ordering convention.
fastingRouter.get("/history", asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const result = await pool.query(
    `SELECT id, goal_hours AS "goalHours", start_time AS "startTime", end_time AS "endTime"
     FROM fasting_sessions
     WHERE user_id = $1 AND end_time IS NOT NULL
     ORDER BY start_time DESC
     LIMIT $2`,
    [req.userId, limit]
  );
  res.json(result.rows);
}));

fastingRouter.post("/start", asyncHandler(async (req, res) => {
  const { goalHours } = req.body as { goalHours?: number };

  const existing = await pool.query(
    `SELECT id FROM fasting_sessions WHERE user_id = $1 AND end_time IS NULL`,
    [req.userId]
  );
  if (existing.rows.length > 0) {
    res.status(409).json({ error: "A fast is already in progress" });
    return;
  }

  const result = await pool.query(
    `INSERT INTO fasting_sessions (user_id, goal_hours)
     VALUES ($1, $2)
     RETURNING id, goal_hours AS "goalHours", start_time AS "startTime", end_time AS "endTime"`,
    [req.userId, goalHours && goalHours > 0 ? goalHours : 16]
  );
  res.status(201).json(result.rows[0]);
}));

fastingRouter.post("/stop", asyncHandler(async (req, res) => {
  const result = await pool.query(
    `UPDATE fasting_sessions
     SET end_time = now()
     WHERE user_id = $1 AND end_time IS NULL
     RETURNING id, goal_hours AS "goalHours", start_time AS "startTime", end_time AS "endTime"`,
    [req.userId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: "No fast in progress" });
    return;
  }
  res.json(result.rows[0]);
}));
