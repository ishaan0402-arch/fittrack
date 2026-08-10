import { Router } from "express";
import { pool } from "../db.js";
import { asyncHandler } from "../asyncHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { localDateString } from "../dateUtils.js";

export const sleepRouter = Router();
sleepRouter.use(requireAuth);

const QUALITIES = ["poor", "fair", "good", "great"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Recent nights, for the Dashboard's sleep trend/average — registered
// before "/:date" for the same reason as every other fixed-segment route
// in this codebase (see routes/workouts.ts's "/summary" comment).
sleepRouter.get("/summary", asyncHandler(async (req, res) => {
  const days = Math.min(Number(req.query.days) || 7, 90);
  const result = await pool.query(
    `SELECT date::text AS date, hours, quality
     FROM sleep_logs
     WHERE user_id = $1 AND date >= CURRENT_DATE - ($2::int - 1)
     ORDER BY date DESC`,
    [req.userId, days]
  );
  res.json(result.rows);
}));

sleepRouter.put("/:date", asyncHandler(async (req, res) => {
  if (!DATE_RE.test(req.params.date)) {
    res.status(400).json({ error: "date must be YYYY-MM-DD" });
    return;
  }
  const { hours, quality } = req.body as { hours?: number; quality?: string };
  if (!hours || hours < 0 || hours > 24) {
    res.status(400).json({ error: "hours must be between 0 and 24" });
    return;
  }
  if (quality && !QUALITIES.includes(quality)) {
    res.status(400).json({ error: `quality must be one of ${QUALITIES.join(", ")}` });
    return;
  }

  const result = await pool.query(
    `INSERT INTO sleep_logs (user_id, date, hours, quality)
     VALUES ($1, $2::date, $3, $4)
     ON CONFLICT (user_id, date) DO UPDATE SET hours = EXCLUDED.hours, quality = EXCLUDED.quality
     RETURNING date::text AS date, hours, quality`,
    [req.userId, req.params.date, hours, quality || null]
  );
  res.status(200).json(result.rows[0]);
}));

sleepRouter.delete("/:date", asyncHandler(async (req, res) => {
  if (!DATE_RE.test(req.params.date)) {
    res.status(400).json({ error: "date must be YYYY-MM-DD" });
    return;
  }
  await pool.query("DELETE FROM sleep_logs WHERE user_id = $1 AND date = $2::date", [
    req.userId,
    req.params.date,
  ]);
  res.status(204).end();
}));

// Kept for symmetry with the rest of the app's "today" convention, though
// the Dashboard card mostly relies on /summary; useful if a per-day view
// gets added later.
sleepRouter.get("/today", asyncHandler(async (req, res) => {
  const today = localDateString();
  const result = await pool.query(
    "SELECT date::text AS date, hours, quality FROM sleep_logs WHERE user_id = $1 AND date = $2::date",
    [req.userId, today]
  );
  res.json(result.rows[0] ?? null);
}));
