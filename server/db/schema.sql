-- password_hash is nullable because Google-sign-in-only accounts have no
-- password; the check constraint ensures every user has at least one way
-- to authenticate. google_id is Google's stable "sub" claim, not the email
-- (emails can change; sub never does).
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  google_id TEXT UNIQUE,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT users_auth_method_check CHECK (password_hash IS NOT NULL OR google_id IS NOT NULL)
);

-- Health profile used to estimate maintenance calories (TDEE). One row per
-- user; created once they complete onboarding.
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id),
  height_cm NUMERIC NOT NULL,
  weight_kg NUMERIC NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
  age INTEGER NOT NULL CHECK (age > 0),
  activity_level TEXT NOT NULL CHECK (
    activity_level IN ('sedentary', 'lightly_active', 'moderately_active', 'heavily_active')
  ),
  -- Drives calorie/macro target adjustments off the base TDEE (see
  -- expenditure.ts) and is surfaced to the AI coach.
  goal TEXT NOT NULL DEFAULT 'maintain' CHECK (
    goal IN ('bulk', 'cut', 'maintain', 'powerlifting', 'bodybuilding', 'general_fitness')
  ),
  -- Optional — powers the Dashboard's weight-goal ETA projection when set.
  target_weight_kg NUMERIC,
  water_goal_ml INTEGER NOT NULL DEFAULT 2500,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Same shape as password_reset_tokens, for the "confirm this email address"
-- link sent (well — logged; no email provider is configured) on signup.
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Local cache of foods we've looked up from USDA FoodData Central, plus
-- user-created custom foods and restaurant menu items. USDA foods have
-- fdc_id set and created_by_user_id NULL (shared cache, visible to
-- everyone); custom foods have fdc_id NULL and created_by_user_id set
-- (private to that user); restaurant items have nix_item_id + restaurant_name
-- set (shared cache, like USDA foods — sourced from Nutritionix).
-- serving_size_grams is meaningful for custom foods and restaurant items —
-- it's the quantity the calories/macros refer to, used to default the
-- logging quantity instead of the usual 100g.
CREATE TABLE IF NOT EXISTS foods (
  id SERIAL PRIMARY KEY,
  fdc_id INTEGER UNIQUE,
  description TEXT NOT NULL,
  calories_per_100g NUMERIC NOT NULL,
  protein_per_100g NUMERIC,
  carbs_per_100g NUMERIC,
  fat_per_100g NUMERIC,
  created_by_user_id INTEGER REFERENCES users(id),
  serving_size_grams NUMERIC,
  barcode TEXT UNIQUE,
  restaurant_name TEXT,
  nix_item_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A user's starred foods, for instant re-logging of staples. Per-user (not a
-- flag on foods itself) since foods rows are shared/cached across users.
CREATE TABLE IF NOT EXISTS favorite_foods (
  user_id INTEGER NOT NULL REFERENCES users(id),
  food_id INTEGER NOT NULL REFERENCES foods(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, food_id)
);

-- Entries a user has logged as eaten. meal_type groups the Diary into
-- Breakfast/Lunch/Dinner/Snack sections instead of one flat list — the
-- route defaults it from the time of day when the client doesn't specify one.
CREATE TABLE IF NOT EXISTS food_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  food_id INTEGER NOT NULL REFERENCES foods(id),
  quantity_grams NUMERIC NOT NULL CHECK (quantity_grams > 0),
  note TEXT,
  meal_type TEXT NOT NULL DEFAULT 'snack' CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Full USDA nutrient breakdown per 100g, fetched lazily the first time a
-- food is actually logged (not at search time, to avoid wasted API calls).
CREATE TABLE IF NOT EXISTS food_nutrients (
  food_id INTEGER NOT NULL REFERENCES foods(id),
  nutrient_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  amount_per_100g NUMERIC NOT NULL,
  PRIMARY KEY (food_id, nutrient_id)
);

-- AI coach chat history, per user.
CREATE TABLE IF NOT EXISTS coach_messages (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Weight check-ins for the Dashboard trend chart. Not every day — logged
-- whenever the user weighs in.
CREATE TABLE IF NOT EXISTS weight_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  weight_kg NUMERIC NOT NULL CHECK (weight_kg > 0),
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A user's saved combination of foods (e.g. "Breakfast smoothie") that can
-- be logged in one action instead of re-adding each food individually.
CREATE TABLE IF NOT EXISTS meals (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS meal_items (
  id SERIAL PRIMARY KEY,
  meal_id INTEGER NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  food_id INTEGER NOT NULL REFERENCES foods(id),
  quantity_grams NUMERIC NOT NULL CHECK (quantity_grams > 0)
);

-- Progress photos with an optional note, tracked chronologically by
-- taken_at. file_path is a path on disk (server/uploads/progress-photos/);
-- images are only ever served back through an authenticated route that
-- checks user_id, never as static files, since these are personal photos.
CREATE TABLE IF NOT EXISTS progress_photos (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  file_path TEXT NOT NULL,
  note TEXT,
  taken_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per calendar day per user — either a rest day or a workout with a
-- short summary/how-it-felt rating. Exercises (with sets/reps/weight) live
-- in workout_exercises so progressive-overload comparisons can query by
-- exercise name across days.
CREATE TABLE IF NOT EXISTS workouts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  date DATE NOT NULL,
  is_rest_day BOOLEAN NOT NULL DEFAULT false,
  summary TEXT,
  felt TEXT CHECK (felt IN ('great', 'good', 'okay', 'tired', 'bad')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

CREATE TABLE IF NOT EXISTS workout_exercises (
  id SERIAL PRIMARY KEY,
  workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sets INTEGER,
  reps INTEGER,
  weight_kg NUMERIC,
  position INTEGER NOT NULL DEFAULT 0
);

-- Daily water intake, logged in ml via quick-add buttons on the Diary.
CREATE TABLE IF NOT EXISTS water_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  amount_ml INTEGER NOT NULL CHECK (amount_ml > 0),
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Body measurements over time (waist, chest, etc.) — lives alongside
-- progress photos on the Progress page as a second way to track change
-- that the scale/calories don't capture.
CREATE TABLE IF NOT EXISTS body_measurements (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  type TEXT NOT NULL CHECK (type IN ('waist', 'chest', 'hips', 'arm', 'thigh', 'neck', 'calf')),
  value_cm NUMERIC NOT NULL CHECK (value_cm > 0),
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A recipe collapses multiple ingredients into ONE loggable custom food
-- (food_id) — unlike meals, which re-log each ingredient as its own entry.
-- recipe_items keeps the ingredient breakdown around for editing/reference;
-- the aggregate nutrition is computed once at save time and stored on the
-- resulting foods row (per-100g, same as any other custom food).
CREATE TABLE IF NOT EXISTS recipes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  food_id INTEGER NOT NULL REFERENCES foods(id),
  servings NUMERIC NOT NULL CHECK (servings > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recipe_items (
  id SERIAL PRIMARY KEY,
  recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  food_id INTEGER NOT NULL REFERENCES foods(id),
  quantity_grams NUMERIC NOT NULL CHECK (quantity_grams > 0)
);
