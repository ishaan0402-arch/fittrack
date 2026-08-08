// Returns the server's local calendar date as "YYYY-MM-DD". Using
// `date.toISOString().slice(0, 10)` for "today" is a trap: it reads the UTC
// calendar date, which is wrong during part of the day whenever the server's
// local timezone isn't UTC (e.g. UTC+3 gets the previous day's date for the
// first few hours after local midnight).
export function localDateString(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

// Sensible default meal type from the time of day, when the client doesn't
// specify one (e.g. logging from the barcode scanner or Meals quick-log,
// neither of which has a meal-type picker). `.getHours()` is always the
// runtime's local hour — no UTC trap here, unlike `.toISOString()`.
export function defaultMealType(date: Date = new Date()): MealType {
  const hour = date.getHours();
  if (hour < 11) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 21) return "dinner";
  return "snack";
}
