import { Router } from "express";
import { pool } from "../db.js";
import { asyncHandler } from "../asyncHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth);

const MIN_SESSIONS_PER_MONTH = 2; // avoid drawing a % change from a single data point
const MIN_PCT_CHANGE = 5; // filter out noise-level fluctuations
const MIN_LOGGED_DAYS_PER_BUCKET = 2; // weekday/weekend comparison needs some sample size

interface Insight {
  id: string;
  message: string;
}

// Exercise weight/volume trend: this calendar month vs the previous one,
// per exercise name. Reports only the single biggest mover in each
// direction so this doesn't turn into a wall of text.
async function exerciseTrendInsights(userId: number): Promise<Insight[]> {
  const result = await pool.query(
    `SELECT
       lower(e.name) AS name,
       date_trunc('month', w.date) = date_trunc('month', CURRENT_DATE) AS is_current_month,
       AVG(e.weight_kg) AS avg_weight,
       SUM(COALESCE(e.sets, 1) * COALESCE(e.reps, 1) * e.weight_kg) AS volume,
       COUNT(DISTINCT w.date) AS sessions
     FROM workout_exercises e
     JOIN workouts w ON w.id = e.workout_id
     WHERE w.user_id = $1 AND e.weight_kg IS NOT NULL
       AND w.date >= date_trunc('month', CURRENT_DATE - interval '1 month')
       AND w.date < date_trunc('month', CURRENT_DATE) + interval '1 month'
     GROUP BY lower(e.name), is_current_month
     HAVING COUNT(DISTINCT w.date) >= $2`,
    [userId, MIN_SESSIONS_PER_MONTH]
  );

  const byExercise = new Map<string, { current?: (typeof result.rows)[number]; previous?: (typeof result.rows)[number] }>();
  for (const row of result.rows) {
    const entry = byExercise.get(row.name) ?? {};
    if (row.is_current_month) entry.current = row;
    else entry.previous = row;
    byExercise.set(row.name, entry);
  }

  type Mover = { name: string; metric: "weight" | "volume"; pctChange: number };
  const movers: Mover[] = [];

  for (const [name, { current, previous }] of byExercise) {
    if (!current || !previous) continue;

    const weightChange = ((Number(current.avg_weight) - Number(previous.avg_weight)) / Number(previous.avg_weight)) * 100;
    if (Math.abs(weightChange) >= MIN_PCT_CHANGE) {
      movers.push({ name, metric: "weight", pctChange: weightChange });
    }

    const volumeChange = ((Number(current.volume) - Number(previous.volume)) / Number(previous.volume)) * 100;
    if (Math.abs(volumeChange) >= MIN_PCT_CHANGE) {
      movers.push({ name, metric: "volume", pctChange: volumeChange });
    }
  }

  const biggestIncrease = movers.filter((m) => m.pctChange > 0).sort((a, b) => b.pctChange - a.pctChange)[0];
  const biggestDecrease = movers.filter((m) => m.pctChange < 0).sort((a, b) => a.pctChange - b.pctChange)[0];

  const format = (m: Mover) => {
    const label = m.name.replace(/\b\w/g, (c) => c.toUpperCase());
    const direction = m.pctChange > 0 ? "increased" : "decreased";
    const metricLabel = m.metric === "weight" ? "average weight" : "volume";
    return `${label} ${metricLabel} ${direction} ${Math.abs(Math.round(m.pctChange))}% this month.`;
  };

  const insights: Insight[] = [];
  if (biggestIncrease) insights.push({ id: `trend-up-${biggestIncrease.name}`, message: format(biggestIncrease) });
  if (biggestDecrease) insights.push({ id: `trend-down-${biggestDecrease.name}`, message: format(biggestDecrease) });
  return insights;
}

// Weekday vs weekend average protein intake over the last 30 days.
async function weekendProteinInsight(userId: number): Promise<Insight[]> {
  const result = await pool.query(
    `SELECT
       day,
       EXTRACT(DOW FROM day) IN (0, 6) AS is_weekend,
       SUM(protein) AS protein
     FROM (
       SELECT l.logged_at::date AS day, f.protein_per_100g * l.quantity_grams / 100 AS protein
       FROM food_logs l
       JOIN foods f ON f.id = l.food_id
       WHERE l.user_id = $1 AND l.logged_at >= CURRENT_DATE - interval '30 days'
     ) per_entry
     GROUP BY day`,
    [userId]
  );

  const weekday: number[] = [];
  const weekend: number[] = [];
  for (const row of result.rows) {
    (row.is_weekend ? weekend : weekday).push(Number(row.protein));
  }

  if (weekday.length < MIN_LOGGED_DAYS_PER_BUCKET || weekend.length < MIN_LOGGED_DAYS_PER_BUCKET) return [];

  const avg = (nums: number[]) => nums.reduce((sum, n) => sum + n, 0) / nums.length;
  const weekdayAvg = avg(weekday);
  const weekendAvg = avg(weekend);
  if (weekdayAvg <= 0) return [];

  const pctChange = ((weekendAvg - weekdayAvg) / weekdayAvg) * 100;
  if (pctChange >= -MIN_PCT_CHANGE) return []; // only flag when weekends are meaningfully lower

  return [
    {
      id: "weekend-protein",
      message: `You're averaging less protein on weekends — ${Math.round(weekendAvg)}g vs ${Math.round(weekdayAvg)}g on weekdays.`,
    },
  ];
}

analyticsRouter.get("/insights", asyncHandler(async (req, res) => {
  const [trend, weekendProtein] = await Promise.all([
    exerciseTrendInsights(req.userId!),
    weekendProteinInsight(req.userId!),
  ]);
  res.json([...trend, ...weekendProtein]);
}));
