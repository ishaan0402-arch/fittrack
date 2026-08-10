import { Router, type Request, type Response } from "express";
import crypto from "node:crypto";
import { pool } from "../db.js";
import { asyncHandler } from "../asyncHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { AUTH_COOKIE, verifyAuthToken } from "../auth.js";
import { CLIENT_ORIGIN } from "../config.js";
import {
  stravaConfigured,
  buildAuthorizeUrl,
  exchangeCodeForToken,
  getValidAccessToken,
  fetchRecentActivities,
} from "../strava.js";

export const stravaRouter = Router();

const CLIENT_URL = CLIENT_ORIGIN;

const STATE_COOKIE = "strava_oauth_state";

// /connect and /callback are full-page browser navigations (an <a href>
// and Strava's own redirect), not fetch calls — requireAuth's JSON 401
// would just render as raw text in the browser, so these two check auth
// manually and redirect to the login page instead.
function getUserIdOrRedirectToLogin(req: Request, res: Response): number | null {
  const token = req.cookies?.[AUTH_COOKIE];
  const userId = token ? verifyAuthToken(token) : null;
  if (!userId) {
    res.redirect(`${CLIENT_URL}/login`);
    return null;
  }
  return userId;
}

stravaRouter.get("/connect", (req, res) => {
  const userId = getUserIdOrRedirectToLogin(req, res);
  if (!userId) return;

  if (!stravaConfigured()) {
    res.redirect(`${CLIENT_URL}/workouts?strava=not_configured`);
    return;
  }

  const state = crypto.randomBytes(16).toString("hex");
  res.cookie(STATE_COOKIE, state, { httpOnly: true, sameSite: "lax", maxAge: 5 * 60 * 1000 });
  res.redirect(buildAuthorizeUrl(state));
});

stravaRouter.get("/callback", asyncHandler(async (req, res) => {
  const userId = getUserIdOrRedirectToLogin(req, res);
  if (!userId) return;

  const { code, state, error } = req.query as { code?: string; state?: string; error?: string };
  res.clearCookie(STATE_COOKIE);

  if (error) {
    res.redirect(`${CLIENT_URL}/workouts?strava=error`);
    return;
  }
  if (!code || !state || state !== req.cookies?.[STATE_COOKIE]) {
    res.redirect(`${CLIENT_URL}/workouts?strava=error`);
    return;
  }

  try {
    const token = await exchangeCodeForToken(code);
    await pool.query(
      `INSERT INTO strava_connections (user_id, strava_athlete_id, access_token, refresh_token, expires_at)
       VALUES ($1, $2, $3, $4, to_timestamp($5))
       ON CONFLICT (user_id) DO UPDATE SET
         strava_athlete_id = EXCLUDED.strava_athlete_id,
         access_token = EXCLUDED.access_token,
         refresh_token = EXCLUDED.refresh_token,
         expires_at = EXCLUDED.expires_at`,
      [userId, token.athlete?.id ?? 0, token.access_token, token.refresh_token, token.expires_at]
    );
    res.redirect(`${CLIENT_URL}/workouts?strava=connected`);
  } catch (err) {
    console.error("Strava OAuth callback failed:", err);
    res.redirect(`${CLIENT_URL}/workouts?strava=error`);
  }
}));

stravaRouter.use(requireAuth);

stravaRouter.get("/status", asyncHandler(async (req, res) => {
  const result = await pool.query(
    "SELECT strava_athlete_id AS \"athleteId\", connected_at AS \"connectedAt\" FROM strava_connections WHERE user_id = $1",
    [req.userId]
  );
  res.json(result.rows[0] ? { connected: true, ...result.rows[0] } : { connected: false });
}));

stravaRouter.post("/sync", asyncHandler(async (req, res) => {
  if (!stravaConfigured()) {
    res.status(503).json({ error: "Strava isn't set up yet — add real STRAVA_CLIENT_ID/SECRET in server/.env." });
    return;
  }

  const accessToken = await getValidAccessToken(req.userId!);
  if (!accessToken) {
    res.status(404).json({ error: "Connect your Strava account first." });
    return;
  }

  const activities = await fetchRecentActivities(accessToken, 50);
  for (const a of activities) {
    await pool.query(
      `INSERT INTO strava_activities
         (user_id, strava_activity_id, name, type, distance_meters, moving_time_seconds, elapsed_time_seconds, total_elevation_gain_meters, start_date, average_speed_mps)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (strava_activity_id) DO UPDATE SET
         name = EXCLUDED.name,
         type = EXCLUDED.type,
         distance_meters = EXCLUDED.distance_meters,
         moving_time_seconds = EXCLUDED.moving_time_seconds,
         elapsed_time_seconds = EXCLUDED.elapsed_time_seconds,
         total_elevation_gain_meters = EXCLUDED.total_elevation_gain_meters,
         average_speed_mps = EXCLUDED.average_speed_mps,
         synced_at = now()`,
      [
        req.userId,
        a.id,
        a.name,
        a.type,
        a.distance,
        a.moving_time,
        a.elapsed_time,
        a.total_elevation_gain,
        a.start_date,
        a.average_speed,
      ]
    );
  }

  res.json({ synced: activities.length });
}));

// Registered before "/:id"-shaped routes would go, though none exist yet —
// kept consistent with the rest of the codebase's route-ordering convention.
stravaRouter.get("/activities", asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const result = await pool.query(
    `SELECT strava_activity_id AS id, name, type,
            distance_meters AS "distanceMeters",
            moving_time_seconds AS "movingTimeSeconds",
            total_elevation_gain_meters AS "totalElevationGainMeters",
            start_date AS "startDate"
     FROM strava_activities
     WHERE user_id = $1
     ORDER BY start_date DESC
     LIMIT $2`,
    [req.userId, limit]
  );
  res.json(result.rows);
}));

// Weekly distance (km), zero-filled — same generate_series pattern as
// /api/workouts/volume, for a trend chart alongside the activity list.
stravaRouter.get("/weekly-distance", asyncHandler(async (req, res) => {
  const weeks = Math.min(Number(req.query.weeks) || 12, 52);
  const result = await pool.query(
    `SELECT
       ws::date::text AS week_start,
       COALESCE((
         SELECT SUM(a.distance_meters) / 1000
         FROM strava_activities a
         WHERE a.user_id = $1 AND date_trunc('week', a.start_date) = ws
       ), 0) AS distance_km
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

stravaRouter.delete("/disconnect", asyncHandler(async (req, res) => {
  await pool.query("DELETE FROM strava_connections WHERE user_id = $1", [req.userId]);
  res.status(204).end();
}));
