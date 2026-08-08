import { Router } from "express";
import { pool } from "../db.js";
import { asyncHandler } from "../asyncHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";

export const measurementsRouter = Router();
measurementsRouter.use(requireAuth);

const MEASUREMENT_TYPES = ["waist", "chest", "hips", "arm", "thigh", "neck", "calf"] as const;

// Most recent value per measurement type — the Progress page's summary view.
measurementsRouter.get("/latest", asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT DISTINCT ON (type) id, type, value_cm, logged_at
     FROM body_measurements
     WHERE user_id = $1
     ORDER BY type, logged_at DESC`,
    [req.userId]
  );
  res.json(result.rows);
}));

// Full history for one measurement type, for a trend view.
measurementsRouter.get("/", asyncHandler(async (req, res) => {
  const type = String(req.query.type ?? "");
  if (!MEASUREMENT_TYPES.includes(type as (typeof MEASUREMENT_TYPES)[number])) {
    res.status(400).json({ error: `type must be one of ${MEASUREMENT_TYPES.join(", ")}` });
    return;
  }

  const result = await pool.query(
    `SELECT id, value_cm, logged_at FROM body_measurements
     WHERE user_id = $1 AND type = $2
     ORDER BY logged_at ASC`,
    [req.userId, type]
  );
  res.json(result.rows);
}));

measurementsRouter.post("/", asyncHandler(async (req, res) => {
  const { type, valueCm } = req.body as { type?: string; valueCm?: number };
  if (!type || !MEASUREMENT_TYPES.includes(type as (typeof MEASUREMENT_TYPES)[number])) {
    res.status(400).json({ error: `type must be one of ${MEASUREMENT_TYPES.join(", ")}` });
    return;
  }
  if (!valueCm || valueCm <= 0) {
    res.status(400).json({ error: "A positive valueCm is required" });
    return;
  }

  const result = await pool.query(
    "INSERT INTO body_measurements (user_id, type, value_cm) VALUES ($1, $2, $3) RETURNING id, type, value_cm, logged_at",
    [req.userId, type, valueCm]
  );
  res.status(201).json(result.rows[0]);
}));

measurementsRouter.delete("/:id", asyncHandler(async (req, res) => {
  const result = await pool.query(
    "DELETE FROM body_measurements WHERE id = $1 AND user_id = $2 RETURNING id",
    [req.params.id, req.userId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: "Entry not found" });
    return;
  }
  res.status(204).end();
}));
