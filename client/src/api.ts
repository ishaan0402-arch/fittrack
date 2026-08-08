export interface Food {
  id: number;
  fdc_id: number;
  description: string;
  calories_per_100g: string;
}

export interface LogEntry {
  id: number;
  food_id: number;
  description: string;
  quantity_grams: string;
  note: string | null;
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

export async function searchFoods(query: string): Promise<Food[]> {
  const res = await fetch(`/api/foods/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error('Food search failed');
  return res.json();
}

export async function logFood(
  foodId: number,
  quantityGrams: number,
  note?: string
): Promise<LogEntry> {
  const res = await fetch('/api/logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ foodId, quantityGrams, note }),
  });
  if (!res.ok) throw new Error('Logging food failed');
  return res.json();
}

export async function deleteLogEntry(id: number): Promise<void> {
  const res = await fetch(`/api/logs/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Removing log entry failed');
}

export async function getTodayLog(): Promise<DayLog> {
  const res = await fetch('/api/logs');
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
  hasProfile: boolean;
}

export async function signup(email: string, password: string): Promise<void> {
  const res = await fetch('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, 'Sign up failed'));
}

export async function login(email: string, password: string): Promise<void> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, 'Login failed'));
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

export interface Profile {
  heightCm: number;
  weightKg: number;
  gender: 'male' | 'female';
  age: number;
  activityLevel: ActivityLevel;
  expenditure: number;
}

export async function getProfile(): Promise<Profile | null> {
  const res = await fetch('/api/profile');
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to fetch profile');
  return res.json();
}

export async function saveProfile(profile: Omit<Profile, 'expenditure'>): Promise<Profile> {
  const res = await fetch('/api/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  });
  if (!res.ok) throw new Error(await errorMessage(res, 'Saving profile failed'));
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
