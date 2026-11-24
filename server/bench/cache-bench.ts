// Standalone benchmark: cache-miss vs cache-hit latency on the food lookup
// path, run directly against Postgres and the real USDA FoodData Central
// API — no mocks, no HTTP server involved.
//
// It calls the exact same two queries routes/foods.ts's GET /search and
// GET /barcode/:code use (cache check against `foods`, then a live USDA
// call + insert on miss), just in-process instead of over HTTP, so the
// numbers reflect the DB/API cost itself rather than Express overhead.
//
// SAFETY:
// - Refuses to run when NODE_ENV=production.
// - To force a real miss it deletes any previously cached rows in `foods`
//   for the exact search terms / barcodes below, then re-inserts what USDA
//   returns. Deletes are row-by-row and wrapped in try/catch: if a row is
//   referenced elsewhere (food_logs, meal_items, recipe_items,
//   favorite_foods, meal_plan_entries all FK to foods.id with no cascade),
//   Postgres rejects that delete and the script leaves it alone rather than
//   forcing it through — it warns and excludes that item instead of
//   corrupting real logged data.
// - Makes 30 x --repeat real USDA API calls. Respect your USDA_API_KEY's
//   rate limit (the public DEMO_KEY is capped around 30 requests/hour/IP).
//
// Usage (from server/):
//   npx tsx bench/cache-bench.ts [--repeat=N] [--json=out.json]

import "dotenv/config";
import { pool } from "../src/db.js";
import { searchUsdaFoods, searchUsdaByBarcode, type NormalizedFood, type BarcodeFood } from "../src/usda.js";
import { writeFileSync } from "node:fs";

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to run: NODE_ENV=production. This script deletes/inserts rows in `foods`.");
  process.exit(1);
}
if (!process.env.USDA_API_KEY) {
  console.error("USDA_API_KEY is not set in server/.env — this benchmark needs a real key to measure real miss latency.");
  process.exit(1);
}

// Single common words, chosen so they're likely to appear as a literal
// substring of USDA's comma-separated descriptions (e.g. "Chicken, broilers
// or fryers, breast, ..." contains "chicken" but not the phrase "chicken
// breast") — the same ILIKE '%term%' the real route uses against `foods`.
const SEARCH_TERMS = [
  "chicken", "rice", "broccoli", "salmon", "potato",
  "yogurt", "almond", "banana", "spinach", "beef",
  "oatmeal", "beans", "avocado", "egg", "quinoa",
  "cheese", "peanut", "bread", "shrimp", "asparagus",
];

// UPC-A codes for common packaged products. Not all are guaranteed to exist
// in USDA's Branded dataset — when one has no match, the script logs it and
// excludes it from hit-phase stats rather than faking a sample.
const BARCODES = [
  "049000028911", "038000138416", "016000275867", "021130126026", "070847811169",
  "012000161155", "044000032029", "018627002131", "079400012802", "025293600016",
];

interface Stats {
  n: number;
  median: number;
  p95: number;
  min: number;
  max: number;
}

function median(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function p95(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1);
  return sorted[idx];
}

function stats(nums: number[]): Stats {
  if (nums.length === 0) return { n: 0, median: NaN, p95: NaN, min: NaN, max: NaN };
  return { n: nums.length, median: median(nums), p95: p95(nums), min: Math.min(...nums), max: Math.max(...nums) };
}

function fmt(s: Stats): string {
  if (s.n === 0) return "n=0 (no samples)";
  return `n=${s.n}  median=${s.median.toFixed(1)}ms  p95=${s.p95.toFixed(1)}ms  min=${s.min.toFixed(1)}ms  max=${s.max.toFixed(1)}ms`;
}

async function timeIt<T>(fn: () => Promise<T>): Promise<{ ms: number; value: T }> {
  const start = process.hrtime.bigint();
  const value = await fn();
  const ms = Number(process.hrtime.bigint() - start) / 1e6;
  return { ms, value };
}

// ---- mirrors routes/foods.ts's cache check + insert, called directly ----

async function cachedSearch(query: string) {
  const result = await pool.query(
    `SELECT id, fdc_id, description, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, serving_size_grams, restaurant_name
     FROM foods WHERE description ILIKE $1 AND created_by_user_id IS NULL LIMIT 10`,
    [`%${query}%`]
  );
  return result.rows;
}

async function insertSearchResults(foods: NormalizedFood[]) {
  for (const food of foods) {
    await pool.query(
      `INSERT INTO foods (fdc_id, description, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (fdc_id) DO UPDATE SET description = EXCLUDED.description`,
      [food.fdcId, food.description, food.caloriesPer100g, food.proteinPer100g, food.carbsPer100g, food.fatPer100g]
    );
  }
}

async function cachedBarcode(code: string) {
  const result = await pool.query(
    `SELECT id, fdc_id, description, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, serving_size_grams
     FROM foods WHERE barcode = $1`,
    [code]
  );
  return result.rows[0] ?? null;
}

async function insertBarcodeResult(code: string, match: BarcodeFood) {
  await pool.query(
    `INSERT INTO foods (fdc_id, description, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, serving_size_grams, barcode)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (fdc_id) DO UPDATE SET barcode = EXCLUDED.barcode, description = EXCLUDED.description`,
    [match.fdcId, match.description, match.caloriesPer100g, match.proteinPer100g, match.carbsPer100g, match.fatPer100g, match.servingSizeGrams, code]
  );
}

// ---- reset: force the next lookup to be a real miss, without touching
// rows a real user's data depends on ----

async function resetRows(idsQuery: string, param: string): Promise<{ deleted: number; skipped: number }> {
  const rows = await pool.query(idsQuery, [param]);
  let deleted = 0;
  let skipped = 0;
  for (const row of rows.rows) {
    try {
      await pool.query("DELETE FROM foods WHERE id = $1", [row.id]);
      deleted++;
    } catch {
      skipped++;
    }
  }
  return { deleted, skipped };
}

const resetSearchTerm = (term: string) =>
  resetRows(`SELECT id FROM foods WHERE description ILIKE $1 AND created_by_user_id IS NULL`, `%${term}%`);

const resetBarcode = (code: string) => resetRows(`SELECT id FROM foods WHERE barcode = $1`, code);

async function main() {
  const repeat = Math.max(1, Number(process.argv.find((a) => a.startsWith("--repeat="))?.split("=")[1] ?? 1));
  const jsonPath = process.argv.find((a) => a.startsWith("--json="))?.split("=")[1];

  console.log(
    `Cache benchmark: ${SEARCH_TERMS.length} search terms + ${BARCODES.length} barcodes, x${repeat} round(s)`
  );
  console.log("Each item: reset cache -> time a real miss (Postgres check + live USDA call + insert) -> time a hit (Postgres check only)\n");

  const missSearch: number[] = [];
  const hitSearch: number[] = [];
  const missBarcode: number[] = [];
  const hitBarcode: number[] = [];
  const unresolvedBarcodes = new Set<string>();
  const perItem: { key: string; kind: "search" | "barcode"; round: number; missMs: number; hitMs: number | null }[] = [];

  for (let round = 1; round <= repeat; round++) {
    for (const term of SEARCH_TERMS) {
      const reset = await resetSearchTerm(term);
      if (reset.skipped > 0) {
        console.warn(`  [search:${term}] round ${round}: ${reset.skipped} cached row(s) left in place (referenced by real data) — miss may be contaminated`);
      }

      const miss = await timeIt(async () => {
        const cached = await cachedSearch(term);
        if (cached.length > 0) return cached;
        const usdaResults = await searchUsdaFoods(term);
        await insertSearchResults(usdaResults);
        return usdaResults;
      });
      missSearch.push(miss.ms);

      const hit = await timeIt(() => cachedSearch(term));
      let hitMs: number | null = null;
      if (hit.value.length === 0) {
        console.warn(`  [search:${term}] round ${round}: no row cached after miss (USDA returned nothing matching) — hit sample excluded`);
      } else {
        hitSearch.push(hit.ms);
        hitMs = hit.ms;
      }
      perItem.push({ key: term, kind: "search", round, missMs: miss.ms, hitMs });
    }

    for (const code of BARCODES) {
      const reset = await resetBarcode(code);
      if (reset.skipped > 0) {
        console.warn(`  [barcode:${code}] round ${round}: ${reset.skipped} cached row(s) left in place (referenced by real data) — miss may be contaminated`);
      }

      const miss = await timeIt(async () => {
        const cached = await cachedBarcode(code);
        if (cached) return cached;
        const match = await searchUsdaByBarcode(code);
        if (match) await insertBarcodeResult(code, match);
        return match;
      });
      missBarcode.push(miss.ms);

      let hitMs: number | null = null;
      if (!miss.value) {
        unresolvedBarcodes.add(code);
        console.warn(`  [barcode:${code}] round ${round}: no USDA match for this barcode — hit sample excluded`);
      } else {
        const hit = await timeIt(() => cachedBarcode(code));
        hitBarcode.push(hit.ms);
        hitMs = hit.ms;
      }
      perItem.push({ key: code, kind: "barcode", round, missMs: miss.ms, hitMs });
    }
  }

  const allMiss = [...missSearch, ...missBarcode];
  const allHit = [...hitSearch, ...hitBarcode];

  console.log("\n=== Results ===");
  console.log(`Search  miss: ${fmt(stats(missSearch))}`);
  console.log(`Search  hit:  ${fmt(stats(hitSearch))}`);
  console.log(`Barcode miss: ${fmt(stats(missBarcode))}`);
  console.log(`Barcode hit:  ${fmt(stats(hitBarcode))}`);
  console.log(`\nCombined miss: ${fmt(stats(allMiss))}`);
  console.log(`Combined hit:  ${fmt(stats(allHit))}`);

  if (allHit.length > 0 && median(allHit) > 0) {
    console.log(`\nMedian speedup (miss / hit): ${(median(allMiss) / median(allHit)).toFixed(1)}x`);
  }
  if (unresolvedBarcodes.size > 0) {
    console.log(
      `\nNote: ${unresolvedBarcodes.size}/${BARCODES.length} barcode(s) had no USDA match (real API response, not an error) — excluded from hit-phase stats: ${[...unresolvedBarcodes].join(", ")}`
    );
  }

  if (jsonPath) {
    writeFileSync(
      jsonPath,
      JSON.stringify(
        {
          repeat,
          searchTerms: SEARCH_TERMS,
          barcodes: BARCODES,
          summary: {
            searchMiss: stats(missSearch),
            searchHit: stats(hitSearch),
            barcodeMiss: stats(missBarcode),
            barcodeHit: stats(hitBarcode),
            combinedMiss: stats(allMiss),
            combinedHit: stats(allHit),
          },
          perItem,
        },
        null,
        2
      )
    );
    console.log(`\nRaw results written to ${jsonPath}`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
