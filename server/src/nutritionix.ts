// Nutritionix has actual restaurant-chain menu items (unlike USDA's Branded
// dataset, which is retail/grocery packaged goods only — verified by testing
// live queries before building this). Two-call pattern, same shape as the
// USDA integration: an instant-search call to find candidate items, then a
// per-item detail call for full macros, since search results don't reliably
// include them.
//
// NOTE: field names below are Nutritionix's documented v2 API shape but
// haven't been verified against a live response yet (no API key was
// available while writing this) — worth a quick sanity check against real
// data the first time a real NUTRITIONIX_APP_ID/API_KEY is added.

const NUTRITIONIX_BASE = "https://trackapi.nutritionix.com/v2";

export function nutritionixConfigured(): boolean {
  return Boolean(process.env.NUTRITIONIX_APP_ID && process.env.NUTRITIONIX_API_KEY);
}

function nutritionixHeaders(): Record<string, string> {
  return {
    "x-app-id": process.env.NUTRITIONIX_APP_ID ?? "",
    "x-app-key": process.env.NUTRITIONIX_API_KEY ?? "",
    "x-remote-user-id": "0",
  };
}

export interface RestaurantMenuItem {
  nixItemId: string;
  description: string;
  restaurantName: string;
  caloriesPer100g: number;
  proteinPer100g: number | null;
  carbsPer100g: number | null;
  fatPer100g: number | null;
  servingSizeGrams: number | null;
}

interface NutritionixInstantBranded {
  food_name: string;
  brand_name: string;
  nix_item_id: string;
}

interface NutritionixFoodDetail {
  food_name: string;
  brand_name?: string;
  nf_calories: number | null;
  nf_protein: number | null;
  nf_total_carbohydrate: number | null;
  nf_total_fat: number | null;
  serving_weight_grams: number | null;
}

async function fetchItemDetail(nixItemId: string): Promise<RestaurantMenuItem | null> {
  const url = new URL(`${NUTRITIONIX_BASE}/search/item`);
  url.searchParams.set("nix_item_id", nixItemId);

  const res = await fetch(url, { headers: nutritionixHeaders() });
  if (!res.ok) return null;

  const data = (await res.json()) as { foods?: NutritionixFoodDetail[] };
  const food = data.foods?.[0];
  const servingGrams = food?.serving_weight_grams ?? null;
  if (!food || food.nf_calories == null || !servingGrams) return null;

  // Nutritionix reports macros per serving, not per 100g — normalize so
  // restaurant items slot into the same foods table (and the same
  // quantity-in-grams logging pipeline) as every other food source.
  const scale = 100 / servingGrams;

  return {
    nixItemId,
    description: food.food_name,
    restaurantName: food.brand_name ?? "",
    caloriesPer100g: food.nf_calories * scale,
    proteinPer100g: food.nf_protein != null ? food.nf_protein * scale : null,
    carbsPer100g: food.nf_total_carbohydrate != null ? food.nf_total_carbohydrate * scale : null,
    fatPer100g: food.nf_total_fat != null ? food.nf_total_fat * scale : null,
    servingSizeGrams: servingGrams,
  };
}

export async function searchRestaurantMenu(
  restaurantName: string,
  query: string
): Promise<RestaurantMenuItem[]> {
  const url = new URL(`${NUTRITIONIX_BASE}/search/instant`);
  url.searchParams.set("query", query ? `${restaurantName} ${query}` : restaurantName);
  url.searchParams.set("branded", "true");
  url.searchParams.set("branded_type", "1"); // 1 = restaurant, per Nutritionix's food-type classification

  const res = await fetch(url, { headers: nutritionixHeaders() });
  if (!res.ok) {
    throw new Error(`Nutritionix API request failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as { branded?: NutritionixInstantBranded[] };
  const branded = data.branded ?? [];

  // The API's own relevance ranking can surface loosely-related brands
  // (e.g. a co-branded product) — keep only items that actually match the
  // requested restaurant's name.
  const normalized = restaurantName.trim().toLowerCase();
  const matches = branded.filter((item) => {
    const brand = item.brand_name?.trim().toLowerCase();
    return brand && (brand.includes(normalized) || normalized.includes(brand));
  });

  const details = await Promise.all(matches.slice(0, 10).map((item) => fetchItemDetail(item.nix_item_id)));
  return details.filter((d): d is RestaurantMenuItem => d !== null);
}
