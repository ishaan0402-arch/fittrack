import { Router } from "express";
import { pool } from "../db.js";
import { asyncHandler } from "../asyncHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";

export const workoutsRouter = Router();
workoutsRouter.use(requireAuth);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const EXERCISES_AGG = `
  COALESCE(
    json_agg(
      json_build_object('id', e.id, 'name', e.name, 'sets', e.sets, 'reps', e.reps, 'weightKg', e.weight_kg)
      ORDER BY e.position
    ) FILTER (WHERE e.id IS NOT NULL),
    '[]'
  ) AS exercises
`;

// Workouts for a given calendar month, for the Workouts calendar view.
workoutsRouter.get("/", asyncHandler(async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const month = Number(req.query.month) || new Date().getMonth() + 1;
  if (month < 1 || month > 12) {
    res.status(400).json({ error: "month must be between 1 and 12" });
    return;
  }

  const result = await pool.query(
    `SELECT w.id, w.date::text AS date, w.is_rest_day, w.summary, w.felt, ${EXERCISES_AGG}
     FROM workouts w
     LEFT JOIN workout_exercises e ON e.workout_id = w.id
     WHERE w.user_id = $1
       AND w.date >= make_date($2, $3, 1)
       AND w.date < (make_date($2, $3, 1) + interval '1 month')
     GROUP BY w.id
     ORDER BY w.date`,
    [req.userId, year, month]
  );

  res.json(result.rows);
}));

// Most recent logged set per exercise name, for progressive-overload
// suggestions while building a new day's workout. One row per distinct
// exercise (case-insensitive) — whichever entry has the latest date wins.
workoutsRouter.get("/exercise-history", asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT DISTINCT ON (lower(e.name))
       e.name, e.sets, e.reps, e.weight_kg AS "weightKg", w.date::text AS date
     FROM workout_exercises e
     JOIN workouts w ON w.id = e.workout_id
     WHERE w.user_id = $1 AND e.weight_kg IS NOT NULL
     ORDER BY lower(e.name), w.date DESC, e.id DESC`,
    [req.userId]
  );
  res.json(result.rows);
}));

// Recent workouts for the Dashboard summary card — registered before
// "/:date" so Express doesn't swallow this path as a date param.
workoutsRouter.get("/summary", asyncHandler(async (req, res) => {
  const days = Math.min(Number(req.query.days) || 7, 90);
  const result = await pool.query(
    `SELECT date::text AS date, is_rest_day, summary, felt
     FROM workouts
     WHERE user_id = $1 AND date >= CURRENT_DATE - ($2::int - 1)
     ORDER BY date DESC`,
    [req.userId, days]
  );
  res.json(result.rows);
}));

// Weekly training volume (sets × reps × weight, summed across all exercises)
// — the Workouts page's volume trend chart, a complement to per-exercise
// progressive-overload suggestions. Zero-filled for weeks with nothing
// logged. Registered before "/:date" for the same reason as "/summary" above.
workoutsRouter.get("/volume", asyncHandler(async (req, res) => {
  const weeks = Math.min(Number(req.query.weeks) || 12, 52);
  const result = await pool.query(
    `SELECT
       ws::date::text AS week_start,
       COALESCE((
         SELECT SUM(e.sets * e.reps * e.weight_kg)
         FROM workouts w
         JOIN workout_exercises e ON e.workout_id = w.id
         WHERE w.user_id = $1
           AND date_trunc('week', w.date) = ws
           AND e.sets IS NOT NULL AND e.reps IS NOT NULL AND e.weight_kg IS NOT NULL
       ), 0) AS volume_kg
     FROM generate_series(
       date_trunc('week', CURRENT_DATE - ($2::int - 1) * interval '7 days'),
       date_trunc('week', CURRENT_DATE),
       interval '7 days'
     ) AS ws
     ORDER BY ws`,
    [req.userId, weeks]
  );
  res.json(result.rows);
}));

workoutsRouter.get("/:date", asyncHandler(async (req, res) => {
  if (!DATE_RE.test(req.params.date)) {
    res.status(400).json({ error: "date must be YYYY-MM-DD" });
    return;
  }

  const result = await pool.query(
    `SELECT w.id, w.date::text AS date, w.is_rest_day, w.summary, w.felt, ${EXERCISES_AGG}
     FROM workouts w
     LEFT JOIN workout_exercises e ON e.workout_id = w.id
     WHERE w.user_id = $1 AND w.date = $2::date
     GROUP BY w.id`,
    [req.userId, req.params.date]
  );

  if (result.rows.length === 0) {
    res.status(404).json({ error: "No workout logged for that date" });
    return;
  }
  res.json(result.rows[0]);
}));

workoutsRouter.put("/:date", asyncHandler(async (req, res) => {
  if (!DATE_RE.test(req.params.date)) {
    res.status(400).json({ error: "date must be YYYY-MM-DD" });
    return;
  }

  const { isRestDay, summary, felt, exercises } = req.body as {
    isRestDay?: boolean;
    summary?: string;
    felt?: string;
    exercises?: { name: string; sets?: number; reps?: number; weightKg?: number }[];
  };

  const validFelt = ["great", "good", "okay", "tired", "bad"];
  if (felt && !validFelt.includes(felt)) {
    res.status(400).json({ error: `felt must be one of ${validFelt.join(", ")}` });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const workout = await client.query(
      `INSERT INTO workouts (user_id, date, is_rest_day, summary, felt)
       VALUES ($1, $2::date, $3, $4, $5)
       ON CONFLICT (user_id, date)
       DO UPDATE SET is_rest_day = EXCLUDED.is_rest_day, summary = EXCLUDED.summary, felt = EXCLUDED.felt
       RETURNING id`,
      [req.userId, req.params.date, Boolean(isRestDay), summary?.trim() || null, felt || null]
    );
    const workoutId = workout.rows[0].id;

    await client.query("DELETE FROM workout_exercises WHERE workout_id = $1", [workoutId]);

    const items = Array.isArray(exercises) ? exercises : [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.name?.trim()) continue;
      await client.query(
        `INSERT INTO workout_exercises (workout_id, name, sets, reps, weight_kg, position)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [workoutId, item.name.trim(), item.sets ?? null, item.reps ?? null, item.weightKg ?? null, i]
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const result = await pool.query(
    `SELECT w.id, w.date::text AS date, w.is_rest_day, w.summary, w.felt, ${EXERCISES_AGG}
     FROM workouts w
     LEFT JOIN workout_exercises e ON e.workout_id = w.id
     WHERE w.user_id = $1 AND w.date = $2::date
     GROUP BY w.id`,
    [req.userId, req.params.date]
  );
  res.status(200).json(result.rows[0]);
}));

workoutsRouter.delete("/:date", asyncHandler(async (req, res) => {
  if (!DATE_RE.test(req.params.date)) {
    res.status(400).json({ error: "date must be YYYY-MM-DD" });
    return;
  }

  const result = await pool.query("DELETE FROM workouts WHERE user_id = $1 AND date = $2::date RETURNING id", [
    req.userId,
    req.params.date,
  ]);
  if (result.rows.length === 0) {
    res.status(404).json({ error: "No workout logged for that date" });
    return;
  }
  res.status(204).end();
}));
