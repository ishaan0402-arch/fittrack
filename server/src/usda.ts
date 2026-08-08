const USDA_SEARCH_URL = "https://api.nal.usda.gov/fdc/v1/foods/search";
const USDA_FOOD_URL = "https://api.nal.usda.gov/fdc/v1/food";

// The USDA detail endpoint returns ~114 nutrients per food (including
// per-amino-acid and per-fatty-acid breakdowns we have no use for). This is
// the subset we actually display, keyed by USDA's stable nutrientId.
const TRACKED_NUTRIENT_IDS = new Set([
  1051, 1057, 1018, // water, caffeine, alcohol
  1005, 1079, 2000, 1009, // carbs, fiber, sugars, starch
  1004, 1258, 1292, 1293, 1257, 1253, // fat, saturated, mono, poly, trans, cholesterol
  1003, // protein
  1162, 1165, 1166, 1167, 1170, 1175, 1177, 1178, 1106, 1109, 1114, 1185, // vitamins
  1087, 1089, 1090, 1091, 1092, 1093, 1095, 1098, 1101, 1103, // minerals
]);

interface UsdaNutrient {
  nutrientName: string;
  unitName: string;
  value: number;
}

interface UsdaFood {
  fdcId: number;
  description: string;
  foodNutrients: UsdaNutrient[];
}

export interface NormalizedFood {
  fdcId: number;
  description: string;
  caloriesPer100g: number;
  proteinPer100g: number | null;
  carbsPer100g: number | null;
  fatPer100g: number | null;
}

// USDA reports "Energy" twice per food (kJ and KCAL as separate entries with
// the same nutrientName), so name alone is ambiguous — unit must be matched too.
function nutrientValue(nutrients: UsdaNutrient[], name: string, unit: string): number | null {
  const match = nutrients.find((n) => n.nutrientName === name && n.unitName === unit);
  return match ? match.value : null;
}

export async function searchUsdaFoods(query: string): Promise<NormalizedFood[]> {
  const url = new URL(USDA_SEARCH_URL);
  url.searchParams.set("api_key", process.env.USDA_API_KEY ?? "");
  url.searchParams.set("query", query);
  url.searchParams.set("pageSize", "5");
  // Foundation/SR Legacy data reports nutrients per 100g, which is what our schema assumes.
  url.searchParams.set("dataType", "Foundation,SR Legacy");

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`USDA API request failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as { foods: UsdaFood[] };

  return data.foods
    .map((food) => {
      const calories = nutrientValue(food.foodNutrients, "Energy", "KCAL");
      if (calories === null) return null;
      return {
        fdcId: food.fdcId,
        description: food.description,
        caloriesPer100g: calories,
        proteinPer100g: nutrientValue(food.foodNutrients, "Protein", "G"),
        carbsPer100g: nutrientValue(food.foodNutrients, "Carbohydrate, by difference", "G"),
        fatPer100g: nutrientValue(food.foodNutrients, "Total lipid (fat)", "G"),
      };
    })
    .filter((f): f is NormalizedFood => f !== null);
}

export interface UsdaNutrientDetail {
  nutrientId: number;
  name: string;
  unit: string;
  amountPer100g: number;
}

interface UsdaFoodDetailNutrient {
  nutrient: { id: number; name: string; unitName: string };
  amount?: number;
}

export async function fetchUsdaFoodDetail(fdcId: number): Promise<UsdaNutrientDetail[]> {
  const url = new URL(`${USDA_FOOD_URL}/${fdcId}`);
  url.searchParams.set("api_key", process.env.USDA_API_KEY ?? "");

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`USDA API request failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as { foodNutrients: UsdaFoodDetailNutrient[] };

  return data.foodNutrients
    .filter((n) => TRACKED_NUTRIENT_IDS.has(n.nutrient.id) && n.amount !== undefined)
    .map((n) => ({
      nutrientId: n.nutrient.id,
      name: n.nutrient.name,
      unit: n.nutrient.unitName,
      amountPer100g: n.amount as number,
    }));
}
