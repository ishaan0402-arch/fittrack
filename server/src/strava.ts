import { pool } from "./db.js";

const AUTHORIZE_URL = "https://www.strava.com/oauth/authorize";
const TOKEN_URL = "https://www.strava.com/oauth/token";
const API_BASE = "https://www.strava.com/api/v3";

export function stravaConfigured(): boolean {
  const id = process.env.STRAVA_CLIENT_ID;
  const secret = process.env.STRAVA_CLIENT_SECRET;
  return Boolean(id) && !id!.startsWith("get_one_at_") && Boolean(secret) && !secret!.startsWith("get_one_at_");
}

function redirectUri(): string {
  return process.env.STRAVA_REDIRECT_URI ?? `http://localhost:${process.env.PORT ?? 3001}/api/strava/callback`;
}

export function buildAuthorizeUrl(state: string): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", process.env.STRAVA_CLIENT_ID ?? "");
  url.searchParams.set("redirect_uri", redirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("approval_prompt", "auto");
  url.searchParams.set("scope", "activity:read_all");
  url.searchParams.set("state", state);
  return url.toString();
}

interface StravaTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix seconds
  athlete?: { id: number };
}

async function requestToken(body: Record<string, string>): Promise<StravaTokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      ...body,
    }),
  });
  if (!res.ok) {
    throw new Error(`Strava token request failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<StravaTokenResponse>;
}

export async function exchangeCodeForToken(code: string): Promise<StravaTokenResponse> {
  return requestToken({ code, grant_type: "authorization_code" });
}

async function refreshAccessToken(refreshToken: string): Promise<StravaTokenResponse> {
  return requestToken({ refresh_token: refreshToken, grant_type: "refresh_token" });
}

// Returns a usable access token for the user, refreshing (and persisting)
// a new one first if the stored token is expired or about to expire —
// Strava access tokens only last ~6 hours. Returns null if the user has
// never connected Strava.
export async function getValidAccessToken(userId: number): Promise<string | null> {
  const result = await pool.query(
    "SELECT access_token, refresh_token, expires_at FROM strava_connections WHERE user_id = $1",
    [userId]
  );
  const row = result.rows[0];
  if (!row) return null;

  if (new Date(row.expires_at).getTime() > Date.now() + 60_000) {
    return row.access_token;
  }

  const refreshed = await refreshAccessToken(row.refresh_token);
  await pool.query(
    `UPDATE strava_connections
     SET access_token = $1, refresh_token = $2, expires_at = to_timestamp($3)
     WHERE user_id = $4`,
    [refreshed.access_token, refreshed.refresh_token, refreshed.expires_at, userId]
  );
  return refreshed.access_token;
}

export interface StravaActivitySummary {
  id: number;
  name: string;
  type: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  start_date: string;
  average_speed: number;
}

export async function fetchRecentActivities(accessToken: string, perPage = 50): Promise<StravaActivitySummary[]> {
  const url = new URL(`${API_BASE}/athlete/activities`);
  url.searchParams.set("per_page", String(perPage));
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    throw new Error(`Strava activities request failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<StravaActivitySummary[]>;
}
