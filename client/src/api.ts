export interface Food {
  id: number;
  fdc_id: number | null;
  description: string;
  calories_per_100g: string;
  protein_per_100g?: string | null;
  carbs_per_100g?: string | null;
  fat_per_100g?: string | null;
  serving_size_grams?: string | null;
  restaurant_name?: string | null;
  /** Only present on RecentFood results — the quantity logged last time, used to default one-tap re-logging. */
  last_quantity_grams?: string | null;
  /** Only populated by endpoints with per-user auth context (recent/custom/favorites) — undefined elsewhere, e.g. search. */
  is_favorite?: boolean;
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

// Mirrors the server's server/src/dateUtils.ts defaultMealType() — used to
// pre-select a sensible meal type in the UI before the request round-trips.
export function defaultMealType(date: Date = new Date()): MealType {
  const hour = date.getHours();
  if (hour < 11) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 21) return 'dinner';
  return 'snack';
}

export interface LogEntry {
  id: number;
  food_id: number;
  description: string;
  quantity_grams: string;
  note: string | null;
  meal_type: MealType;
  calories: string;
  logged_at: string;
}

export interface DayTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface NutrientTotal {
  nutrient_id: number;
  name: string;
  unit: string;
  amount: string;
}

export interface DayLog {
  date: string;
  entries: LogEntry[];
  totals: DayTotals;
  nutrients: NutrientTotal[];
}

export async function searchFoods(query: string, restaurant?: string): Promise<Food[]> {
  const params = new URLSearchParams({ q: query });
  if (restaurant) params.set('restaurant', restaurant);
  const res = await fetch(`/api/foods/search?${params.toString()}`);
  if (!res.ok) throw new Error('Food search failed');
  return res.json();
}

export interface NearbyRestaurant {
  name: string;
  placeId: string;
  vicinity: string | null;
}

export async function getNearbyRestaurants(lat: number, lng: number): Promise<NearbyRestaurant[]> {
  const res = await fetch(`/api/restaurants/nearby?lat=${lat}&lng=${lng}`);
  if (!res.ok) throw new Error(await errorMessage(res, 'Finding nearby restaurants failed'));
  return res.json();
}

export interface RecentFood extends Food {
  last_logged_at: string;
  times_logged: string;
  last_quantity_grams: string;
}

export async function getRecentFoods(): Promise<RecentFood[]> {
  const res = await fetch('/api/foods/recent');
  if (!res.ok) throw new Error('Failed to load recent foods');
  return res.json();
}

export async function logFood(
  foodId: number,
  quantityGrams: number,
  note?: string,
  mealType?: MealType
): Promise<LogEntry> {
  const res = await fetch('/api/logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ foodId, quantityGrams, note, mealType }),
  });
  if (!res.ok) throw new Error('Logging food failed');
  return res.json();
}

export async function deleteLogEntry(id: number): Promise<void> {
  const res = await fetch(`/api/logs/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Removing log entry failed');
}

export async function updateLogEntry(
  id: number,
  quantityGrams: number,
  note?: string,
  mealType?: MealType
): Promise<LogEntry> {
  const res = await fetch(`/api/logs/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quantityGrams, note, mealType }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, 'Updating the entry failed'));
  return res.json();
}

export async function getTodayLog(): Promise<DayLog> {
  const res = await fetch('/api/logs');
  if (!res.ok) throw new Error('Fetching log failed');
  return res.json();
}

export async function getLogForDate(date: string): Promise<DayLog> {
  const res = await fetch(`/api/logs?date=${date}`);
  if (!res.ok) throw new Error('Fetching log failed');
  return res.json();
}

async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
}

export interface AuthUser {
  id: number;
  email: string;
  name: string | null;
  emailVerified: boolean;
  isGoogleAccount: boolean;
  hasProfile: boolean;
}

export async function signup(email: string, password: string): Promise<{ devVerificationLink?: string }> {
  const res = await fetch('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, 'Sign up failed'));
  return res.json();
}

export async function login(email: string, password: string): Promise<void> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, 'Login failed'));
}

export async function googleSignIn(idToken: string): Promise<void> {
  const res = await fetch('/api/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, 'Google sign-in failed'));
}

export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' });
}

export async function devLogin(): Promise<void> {
  const res = await fetch('/api/auth/dev-login', { method: 'POST' });
  if (!res.ok) throw new Error(await errorMessage(res, 'Dev login failed'));
}

export async function getMe(): Promise<AuthUser | null> {
  const res = await fetch('/api/auth/me');
  if (res.status === 401) return null;
  if (!res.ok) throw new Error('Failed to fetch session');
  return res.json();
}

export async function verifyEmail(token: string): Promise<void> {
  const res = await fetch('/api/auth/verify-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, 'Verification failed'));
}

export async function resendVerification(): Promise<{ devVerificationLink?: string }> {
  const res = await fetch('/api/auth/resend-verification', { method: 'POST' });
  if (!res.ok) throw new Error(await errorMessage(res, 'Could not resend verification link'));
  return res.json();
}

export async function requestPasswordReset(
  email: string
): Promise<{ message: string; devResetLink?: string }> {
  const res = await fetch('/api/auth/request-password-reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, 'Request failed'));
  return res.json();
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const res = await fetch('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, newPassword }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, 'Reset failed'));
}

export type ActivityLevel = 'sedentary' | 'lightly_active' | 'moderately_active' | 'heavily_active';

export type Goal = 'bulk' | 'cut' | 'maintain' | 'powerlifting' | 'bodybuilding' | 'general_fitness';

export const GOAL_OPTIONS: { value: Goal; label: string }[] = [
  { value: 'bulk', label: 'Bulk' },
  { value: 'cut', label: 'Cut' },
  { value: 'maintain', label: 'Maintain' },
  { value: 'powerlifting', label: 'Powerlifting' },
  { value: 'bodybuilding', label: 'Bodybuilding' },
  { value: 'general_fitness', label: 'General fitness' },
]

export interface ProfileInput {
  heightCm: number;
  weightKg: number;
  gender: 'male' | 'female';
  age: number;
  activityLevel: ActivityLevel;
  goal: Goal;
  targetWeightKg?: number | null;
  waterGoalMl?: number;
}

export interface MacroTargets {
  protein: number;
  carbs: number;
  fat: number;
}

export interface Profile extends ProfileInput {
  targetWeightKg: number | null;
  waterGoalMl: number;
  expenditure: number;
  calorieTarget: number;
  macroTargets: MacroTargets;
}

export async function getProfile(): Promise<Profile | null> {
  const res = await fetch('/api/profile');
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to fetch profile');
  return res.json();
}

export async function saveProfile(profile: ProfileInput): Promise<Profile> {
  const res = await fetch('/api/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  });
  if (!res.ok) throw new Error(await errorMessage(res, 'Saving profile failed'));
  return res.json();
}

export interface AdaptiveTarget {
  available: boolean;
  calorieTarget: number;
  baseTarget?: number;
  avgCalories?: number;
  actualWeeklyRateKg?: number;
  expectedWeeklyRateKg?: number;
  daysOfData?: number;
}

export async function getAdaptiveTarget(): Promise<AdaptiveTarget> {
  const res = await fetch('/api/profile/adaptive-target');
  if (!res.ok) throw new Error('Failed to load adaptive target');
  return res.json();
}

export interface CoachMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export async function getCoachMessages(): Promise<CoachMessage[]> {
  const res = await fetch('/api/coach/messages');
  if (!res.ok) throw new Error('Failed to load coach history');
  return res.json();
}

export async function sendCoachMessage(message: string): Promise<CoachMessage> {
  const res = await fetch('/api/coach/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, 'The coach could not respond'));
  return res.json();
}

export interface WeightEntry {
  id: number;
  weight_kg: string;
  logged_at: string;
}

export async function getWeightHistory(days = 30): Promise<WeightEntry[]> {
  const res = await fetch(`/api/weight?days=${days}`);
  if (!res.ok) throw new Error('Failed to load weight history');
  return res.json();
}

export async function logWeight(weightKg: number): Promise<WeightEntry> {
  const res = await fetch('/api/weight', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ weightKg }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, 'Logging weight failed'));
  return res.json();
}

export interface DailyCalories {
  date: string;
  calories: string;
}

export async function getCalorieHistory(days = 14): Promise<DailyCalories[]> {
  const res = await fetch(`/api/logs/history?days=${days}`);
  if (!res.ok) throw new Error('Failed to load calorie history');
  return res.json();
}

export interface NutrientSummary {
  daysWithData: number;
  nutrients: { nutrient_id: number; total_amount: string }[];
}

export async function getNutrientSummary(days = 7): Promise<NutrientSummary> {
  const res = await fetch(`/api/logs/nutrient-summary?days=${days}`);
  if (!res.ok) throw new Error('Failed to load nutrient summary');
  return res.json();
}

export interface Streak {
  streak: number;
  longestStreak: number;
}

export async function getStreak(): Promise<Streak> {
  const res = await fetch('/api/logs/streak');
  if (!res.ok) throw new Error('Failed to load streak');
  return res.json();
}

export async function getFoodByBarcode(code: string): Promise<Food | null> {
  const res = await fetch(`/api/foods/barcode/${encodeURIComponent(code)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Barcode lookup failed');
  return res.json();
}

// A single-product read off a Nutrition Facts label — distinct from
// NutritionEstimateItem (which estimates a plate of food), since a label
// scan reports exact printed values for one product's serving size.
export interface LabelScanResult {
  labelFound: boolean;
  productName: string;
  servingSizeDescription: string;
  servingSizeGrams: number;
  caloriesPerServing: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  note: string;
}

export async function scanNutritionLabel(file: File): Promise<LabelScanResult> {
  const formData = new FormData();
  formData.append('photo', file);
  const res = await fetch('/api/label-scan/scan', { method: 'POST', body: formData });
  if (!res.ok) throw new Error(await errorMessage(res, 'Reading the nutrition label failed'));
  return res.json();
}

export async function getCustomFoods(): Promise<Food[]> {
  const res = await fetch('/api/foods/custom');
  if (!res.ok) throw new Error('Failed to load your custom foods');
  return res.json();
}

export async function getFavoriteFoods(): Promise<Food[]> {
  const res = await fetch('/api/foods/favorites');
  if (!res.ok) throw new Error('Failed to load your favorite foods');
  return res.json();
}

export async function addFavoriteFood(id: number): Promise<void> {
  const res = await fetch(`/api/foods/${id}/favorite`, { method: 'POST' });
  if (!res.ok) throw new Error(await errorMessage(res, 'Adding favorite failed'));
}

export async function removeFavoriteFood(id: number): Promise<void> {
  const res = await fetch(`/api/foods/${id}/favorite`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await errorMessage(res, 'Removing favorite failed'));
}

export async function createCustomFood(input: {
  description: string;
  servingSizeGrams: number;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}): Promise<Food> {
  const res = await fetch('/api/foods/custom', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await errorMessage(res, 'Creating the food failed'));
  return res.json();
}

// Shared shape returned by both AI estimation routes (photo and text) — same
// output either way, only the input differs.
export interface NutritionEstimateItem {
  description: string;
  estimatedQuantityGrams: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  note: string;
}

export async function estimatePhotoNutrition(file: File): Promise<{ items: NutritionEstimateItem[] }> {
  const formData = new FormData();
  formData.append('photo', file);
  const res = await fetch('/api/photo-log/estimate', { method: 'POST', body: formData });
  if (!res.ok) throw new Error(await errorMessage(res, 'Estimating nutrition from the photo failed'));
  return res.json();
}

export async function estimateTextNutrition(description: string): Promise<{ items: NutritionEstimateItem[] }> {
  const res = await fetch('/api/text-log/estimate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, 'Estimating nutrition from the description failed'));
  return res.json();
}

export interface Meal {
  id: number;
  name: string;
  created_at: string;
  item_count: string;
  calories: string;
}

export interface MealItem {
  id: number;
  food_id: number;
  description: string;
  quantity_grams: string;
  calories: string;
}

export interface MealDetail {
  id: number;
  name: string;
  created_at: string;
  items: MealItem[];
}

export async function getMeals(): Promise<Meal[]> {
  const res = await fetch('/api/meals');
  if (!res.ok) throw new Error('Failed to load meals');
  return res.json();
}

export async function getMeal(id: number): Promise<MealDetail> {
  const res = await fetch(`/api/meals/${id}`);
  if (!res.ok) throw new Error('Failed to load meal');
  return res.json();
}

export async function createMeal(
  name: string,
  items: { foodId: number; quantityGrams: number }[]
): Promise<Meal> {
  const res = await fetch('/api/meals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, items }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, 'Saving the meal failed'));
  return res.json();
}

export async function deleteMeal(id: number): Promise<void> {
  const res = await fetch(`/api/meals/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Deleting the meal failed');
}

export async function logMeal(id: number, mealType?: MealType): Promise<void> {
  const res = await fetch(`/api/meals/${id}/log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mealType }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, 'Logging the meal failed'));
}

export interface ProgressPhoto {
  id: number;
  note: string | null;
  taken_at: string;
}

export async function getProgressPhotos(): Promise<ProgressPhoto[]> {
  const res = await fetch('/api/progress-photos');
  if (!res.ok) throw new Error('Failed to load progress photos');
  return res.json();
}

export async function uploadProgressPhoto(file: File, note?: string): Promise<ProgressPhoto> {
  const formData = new FormData();
  formData.append('photo', file);
  if (note) formData.append('note', note);
  const res = await fetch('/api/progress-photos', { method: 'POST', body: formData });
  if (!res.ok) throw new Error(await errorMessage(res, 'Uploading photo failed'));
  return res.json();
}

export async function deleteProgressPhoto(id: number): Promise<void> {
  const res = await fetch(`/api/progress-photos/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Deleting photo failed');
}

export function progressPhotoImageUrl(id: number): string {
  return `/api/progress-photos/${id}/image`;
}

export type FeltRating = 'great' | 'good' | 'okay' | 'tired' | 'bad';

export interface WorkoutExercise {
  id?: number;
  name: string;
  sets: number | null;
  reps: number | null;
  weightKg: number | null;
}

export interface Workout {
  id: number;
  date: string;
  is_rest_day: boolean;
  summary: string | null;
  felt: FeltRating | null;
  exercises: WorkoutExercise[];
}

export async function getWorkoutsForMonth(year: number, month: number): Promise<Workout[]> {
  const res = await fetch(`/api/workouts?year=${year}&month=${month}`);
  if (!res.ok) throw new Error('Failed to load workouts');
  return res.json();
}

export async function saveWorkout(
  date: string,
  input: {
    isRestDay: boolean;
    summary: string;
    felt: FeltRating | null;
    exercises: { name: string; sets?: number | null; reps?: number | null; weightKg?: number | null }[];
  }
): Promise<Workout> {
  const res = await fetch(`/api/workouts/${date}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await errorMessage(res, 'Saving workout failed'));
  return res.json();
}

export async function deleteWorkout(date: string): Promise<void> {
  const res = await fetch(`/api/workouts/${date}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Deleting workout failed');
}

export interface ExerciseHistoryEntry {
  name: string;
  sets: number | null;
  reps: number | null;
  weightKg: string;
  date: string;
}

export async function getExerciseHistory(): Promise<ExerciseHistoryEntry[]> {
  const res = await fetch('/api/workouts/exercise-history');
  if (!res.ok) throw new Error('Failed to load exercise history');
  return res.json();
}

export interface WeeklyVolume {
  week_start: string;
  volume_kg: string;
}

export async function getWorkoutVolume(weeks = 12): Promise<WeeklyVolume[]> {
  const res = await fetch(`/api/workouts/volume?weeks=${weeks}`);
  if (!res.ok) throw new Error('Failed to load workout volume');
  return res.json();
}

export interface OneRepMaxPoint {
  date: string;
  e1rm: string;
}

export async function getOneRepMaxTrend(exercise: string): Promise<OneRepMaxPoint[]> {
  const res = await fetch(`/api/workouts/1rm?exercise=${encodeURIComponent(exercise)}`);
  if (!res.ok) throw new Error('Failed to load 1RM trend');
  return res.json();
}

export interface WorkoutSummaryEntry {
  date: string;
  is_rest_day: boolean;
  summary: string | null;
  felt: FeltRating | null;
}

export async function getWorkoutSummary(days = 7): Promise<WorkoutSummaryEntry[]> {
  const res = await fetch(`/api/workouts/summary?days=${days}`);
  if (!res.ok) throw new Error('Failed to load workout summary');
  return res.json();
}

export interface Notification {
  id: string;
  message: string;
}

export async function getNotifications(): Promise<Notification[]> {
  const res = await fetch('/api/notifications');
  if (!res.ok) throw new Error('Failed to load notifications');
  return res.json();
}

export interface Insight {
  id: string;
  message: string;
}

export async function getInsights(): Promise<Insight[]> {
  const res = await fetch('/api/analytics/insights');
  if (!res.ok) throw new Error('Failed to load insights');
  return res.json();
}

export interface WaterEntry {
  id: number;
  amount_ml: number;
  logged_at: string;
}

export interface TodayWater {
  entries: WaterEntry[];
  totalMl: number;
  goalMl: number;
}

export async function getTodayWater(): Promise<TodayWater> {
  const res = await fetch('/api/water/today');
  if (!res.ok) throw new Error('Failed to load water intake');
  return res.json();
}

export async function logWater(amountMl: number): Promise<WaterEntry> {
  const res = await fetch('/api/water', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amountMl }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, 'Logging water failed'));
  return res.json();
}

export async function deleteWaterEntry(id: number): Promise<void> {
  const res = await fetch(`/api/water/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Removing entry failed');
}

export type MeasurementType = 'waist' | 'chest' | 'hips' | 'arm' | 'thigh' | 'neck' | 'calf';

export const MEASUREMENT_TYPE_LABELS: Record<MeasurementType, string> = {
  waist: 'Waist',
  chest: 'Chest',
  hips: 'Hips',
  arm: 'Arm',
  thigh: 'Thigh',
  neck: 'Neck',
  calf: 'Calf',
};

export interface Measurement {
  id: number;
  value_cm: string;
  logged_at: string;
}

export interface LatestMeasurement {
  id: number;
  type: MeasurementType;
  value_cm: string;
  logged_at: string;
}

export async function getLatestMeasurements(): Promise<LatestMeasurement[]> {
  const res = await fetch('/api/measurements/latest');
  if (!res.ok) throw new Error('Failed to load measurements');
  return res.json();
}

export async function getMeasurementHistory(type: MeasurementType): Promise<Measurement[]> {
  const res = await fetch(`/api/measurements?type=${type}`);
  if (!res.ok) throw new Error('Failed to load measurement history');
  return res.json();
}

export async function logMeasurement(type: MeasurementType, valueCm: number): Promise<Measurement> {
  const res = await fetch('/api/measurements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, valueCm }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, 'Logging measurement failed'));
  return res.json();
}

export async function deleteMeasurement(id: number): Promise<void> {
  const res = await fetch(`/api/measurements/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Removing measurement failed');
}

// Recipe-shaped-as-Food — a recipe collapses multiple ingredients into one
// loggable food (unlike Meals, which re-logs each ingredient separately).
export interface Recipe extends Food {
  recipe_id: number;
  servings: string;
}

export interface RecipeItem {
  id: number;
  food_id: number;
  description: string;
  quantity_grams: string;
}

export interface RecipeDetail {
  id: number;
  servings: string;
  description: string;
  serving_size_grams: string | null;
  items: RecipeItem[];
}

export async function getRecipes(): Promise<Recipe[]> {
  const res = await fetch('/api/recipes');
  if (!res.ok) throw new Error('Failed to load recipes');
  return res.json();
}

export async function getRecipe(id: number): Promise<RecipeDetail> {
  const res = await fetch(`/api/recipes/${id}`);
  if (!res.ok) throw new Error('Failed to load recipe');
  return res.json();
}

export async function createRecipe(
  name: string,
  servings: number,
  ingredients: { foodId: number; quantityGrams: number }[]
): Promise<Recipe> {
  const res = await fetch('/api/recipes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, servings, ingredients }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, 'Saving the recipe failed'));
  return res.json();
}

export async function deleteRecipe(recipeId: number): Promise<void> {
  const res = await fetch(`/api/recipes/${recipeId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Deleting the recipe failed');
}

export interface FastingSession {
  id: number;
  goalHours: string;
  startTime: string;
  endTime: string | null;
}

export async function getCurrentFast(): Promise<FastingSession | null> {
  const res = await fetch('/api/fasting/current');
  if (!res.ok) throw new Error('Failed to load fasting status');
  return res.json();
}

export async function getFastingHistory(limit = 20): Promise<FastingSession[]> {
  const res = await fetch(`/api/fasting/history?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to load fasting history');
  return res.json();
}

export async function startFast(goalHours: number): Promise<FastingSession> {
  const res = await fetch('/api/fasting/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goalHours }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, 'Starting the fast failed'));
  return res.json();
}

export async function stopFast(): Promise<FastingSession> {
  const res = await fetch('/api/fasting/stop', { method: 'POST' });
  if (!res.ok) throw new Error(await errorMessage(res, 'Ending the fast failed'));
  return res.json();
}

export interface MealSuggestionItem {
  name: string;
  quantityGrams: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  reason: string;
}

export interface MealSuggestions {
  remaining: { calories: number; protein: number; carbs: number; fat: number };
  items: MealSuggestionItem[];
}

export async function getMealSuggestions(): Promise<MealSuggestions> {
  const res = await fetch('/api/meal-suggest/suggest', { method: 'POST' });
  if (!res.ok) throw new Error(await errorMessage(res, 'Getting suggestions failed'));
  return res.json();
}

export interface StravaStatus {
  connected: boolean;
  athleteId?: number;
  connectedAt?: string;
}

export interface StravaActivity {
  id: number;
  name: string;
  type: string;
  distanceMeters: string;
  movingTimeSeconds: number;
  totalElevationGainMeters: string;
  startDate: string;
}

export interface StravaWeeklyDistance {
  week_start: string;
  distance_km: string;
}

export async function getStravaStatus(): Promise<StravaStatus> {
  const res = await fetch('/api/strava/status');
  if (!res.ok) throw new Error('Failed to load Strava connection status');
  return res.json();
}

export async function getStravaActivities(limit = 20): Promise<StravaActivity[]> {
  const res = await fetch(`/api/strava/activities?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to load Strava activities');
  return res.json();
}

export async function getStravaWeeklyDistance(weeks = 12): Promise<StravaWeeklyDistance[]> {
  const res = await fetch(`/api/strava/weekly-distance?weeks=${weeks}`);
  if (!res.ok) throw new Error('Failed to load Strava weekly distance');
  return res.json();
}

export async function syncStrava(): Promise<{ synced: number }> {
  const res = await fetch('/api/strava/sync', { method: 'POST' });
  if (!res.ok) throw new Error(await errorMessage(res, 'Syncing with Strava failed'));
  return res.json();
}

export async function disconnectStrava(): Promise<void> {
  const res = await fetch('/api/strava/disconnect', { method: 'DELETE' });
  if (!res.ok) throw new Error('Disconnecting Strava failed');
}

export type SleepQuality = 'poor' | 'fair' | 'good' | 'great';

export interface SleepEntry {
  date: string;
  hours: string;
  quality: SleepQuality | null;
}

export async function getSleepSummary(days = 7): Promise<SleepEntry[]> {
  const res = await fetch(`/api/sleep/summary?days=${days}`);
  if (!res.ok) throw new Error('Failed to load sleep history');
  return res.json();
}

export async function logSleep(date: string, hours: number, quality?: SleepQuality): Promise<SleepEntry> {
  const res = await fetch(`/api/sleep/${date}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hours, quality }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, 'Logging sleep failed'));
  return res.json();
}

export interface MealPlanEntry {
  id: number;
  date: string;
  meal_type: MealType;
  food_id: number;
  quantity_grams: string;
  description: string;
  calories: string;
}

export interface GroceryListItem {
  food_id: number;
  description: string;
  total_quantity_grams: string;
}

export async function getMealPlanRange(start: string, end: string): Promise<MealPlanEntry[]> {
  const res = await fetch(`/api/meal-plan/range?start=${start}&end=${end}`);
  if (!res.ok) throw new Error('Failed to load meal plan');
  return res.json();
}

export async function getGroceryList(start: string, end: string): Promise<GroceryListItem[]> {
  const res = await fetch(`/api/meal-plan/grocery-list?start=${start}&end=${end}`);
  if (!res.ok) throw new Error('Failed to load grocery list');
  return res.json();
}

export async function addMealPlanEntry(
  date: string,
  mealType: MealType,
  foodId: number,
  quantityGrams: number
): Promise<MealPlanEntry> {
  const res = await fetch('/api/meal-plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, mealType, foodId, quantityGrams }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, 'Adding to your plan failed'));
  return res.json();
}

export async function addMealToPlan(date: string, mealType: MealType, mealId: number): Promise<MealPlanEntry[]> {
  const res = await fetch('/api/meal-plan/add-meal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, mealType, mealId }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, 'Adding the meal to your plan failed'));
  return res.json();
}

export async function logMealPlanEntry(id: number): Promise<void> {
  const res = await fetch(`/api/meal-plan/${id}/log`, { method: 'POST' });
  if (!res.ok) throw new Error(await errorMessage(res, 'Logging that item failed'));
}

export async function deleteMealPlanEntry(id: number): Promise<void> {
  const res = await fetch(`/api/meal-plan/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Removing that item failed');
}
