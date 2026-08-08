CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
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

-- Local cache of foods we've looked up from USDA FoodData Central.
CREATE TABLE IF NOT EXISTS foods (
  id SERIAL PRIMARY KEY,
  fdc_id INTEGER NOT NULL UNIQUE,
  description TEXT NOT NULL,
  calories_per_100g NUMERIC NOT NULL,
  protein_per_100g NUMERIC,
  carbs_per_100g NUMERIC,
  fat_per_100g NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Entries a user has logged as eaten.
CREATE TABLE IF NOT EXISTS food_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  food_id INTEGER NOT NULL REFERENCES foods(id),
  quantity_grams NUMERIC NOT NULL CHECK (quantity_grams > 0),
  note TEXT,
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
