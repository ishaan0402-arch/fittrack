const PLACES_BASE = "https://maps.googleapis.com/maps/api/place";
const SEARCH_RADIUS_METERS = 800; // roughly half a mile

// Thrown when Google rejects the API key itself (missing, placeholder, or
// revoked) — distinct from other failures so callers can show a clean
// "not set up yet" message instead of Google's raw error text.
export class GooglePlacesAuthError extends Error {}

export function googlePlacesConfigured(): boolean {
  return Boolean(process.env.GOOGLE_PLACES_API_KEY);
}

export interface NearbyRestaurant {
  name: string;
  placeId: string;
  vicinity: string | null;
}

interface PlacesNearbyResult {
  name: string;
  place_id: string;
  vicinity?: string;
}

export async function findNearbyRestaurants(lat: number, lng: number): Promise<NearbyRestaurant[]> {
  const url = new URL(`${PLACES_BASE}/nearbysearch/json`);
  url.searchParams.set("location", `${lat},${lng}`);
  url.searchParams.set("radius", String(SEARCH_RADIUS_METERS));
  url.searchParams.set("type", "restaurant");
  url.searchParams.set("key", process.env.GOOGLE_PLACES_API_KEY ?? "");

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Google Places API request failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as {
    status: string;
    error_message?: string;
    results?: PlacesNearbyResult[];
  };
  if (data.status === "REQUEST_DENIED") {
    throw new GooglePlacesAuthError(data.error_message ?? "Google Places rejected the API key");
  }
  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    throw new Error(`Google Places API error: ${data.status}${data.error_message ? ` — ${data.error_message}` : ""}`);
  }

  // Chains often return several nearby branches — de-dupe by name since the
  // user just wants to pick "McDonald's", not a specific location.
  const seen = new Set<string>();
  const unique: NearbyRestaurant[] = [];
  for (const r of data.results ?? []) {
    const key = r.name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({ name: r.name, placeId: r.place_id, vicinity: r.vicinity ?? null });
  }
  return unique;
}
