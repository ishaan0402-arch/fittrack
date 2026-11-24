# FitTrack

A full-stack nutrition and training tracker. Log what you eat, track your workouts, and watch your progress over time, with an AI coach built on Claude.

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Claude](https://img.shields.io/badge/AI-Claude-D97757)

---

## Features

### 🍎 Nutrition
- **Food diary**: log meals by day, with a calorie gauge and full macro and micronutrient breakdowns.
- **Food search**: search the USDA FoodData Central database, with results cached in Postgres so repeat searches are fast.
- **Barcode scanning**: scan packaged foods with your phone camera.
- **AI photo logging**: take a picture of your plate and Claude estimates what's on it.
- **AI text logging**: type something like "two eggs and a slice of toast" and get loggable entries back.
- **Nutrition label scanning**: photograph a Nutrition Facts panel to add a product exactly as printed.
- **"What should I eat?"**: get meal suggestions sized to the calories and macros you have left today.
- **Saved meals, recipes and favorites**: log your usual foods in one tap.
- **Meal planner**: plan the week ahead and generate a combined grocery list.
- **Nearby restaurants**: find restaurants near you and log meals from them.
- **Water tracking** and **intermittent fasting** with a live fasting timer.

### 🏋️ Training
- **Workout logging**: exercises, sets, reps and weight.
- **Rest timer** and **plate calculator** for use during a session.
- **Strength standards**: see how your squat, bench, deadlift and overhead press compare with bodyweight-based benchmarks (Beginner to Elite).
- **Strava integration**: connect your account to import activities.

### 📈 Progress
- **Personalized targets**: calorie and macro goals calculated from your profile, activity level and goal (cut, bulk, maintain, powerlifting, bodybuilding or general fitness).
- **Weight trends and charts**.
- **Body measurements**, with a body-fat estimate using the US Navy tape method.
- **Progress photos**.
- **Sleep logging**.
- **Streaks and reminders**, such as a nudge when you haven't weighed in for a week.
- **CSV export** of your food log and weight history.

### 🤖 AI Coach
Chat with a coach that knows your goals and recent logs. It's powered by Anthropic's Claude API.

### 📱 Installable
FitTrack is a Progressive Web App, so you can add it to your phone's home screen.

---

## Tech Stack

| Layer | Tech |
| --- | --- |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS 4, React Router, shadcn/ui-style components, Lucide icons |
| **Backend** | Node.js, Express, TypeScript (run with `tsx`) |
| **Database** | PostgreSQL 16 (via Docker) |
| **Auth** | JWT in HTTP-only cookies, bcrypt password hashing, Google Sign-In, email verification and password reset |
| **AI** | Anthropic Claude API (coach, photo, text and label logging, meal suggestions) |
| **Integrations** | USDA FoodData Central, Nutritionix, Google Places, Strava |
| **Security** | Helmet, CORS locked to the client origin, rate limiting (stricter on AI endpoints) |

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) 20+
- [Docker Desktop](https://www.docker.com/products/docker-desktop/), for the database

### 1. Clone the repo
```bash
git clone <your-repo-url>
cd fittrack
```

### 2. Start the database
```bash
docker compose up -d
```
This starts Postgres on port `5432` and loads the schema from [`server/db/schema.sql`](server/db/schema.sql) automatically the first time.

### 3. Configure the server
```bash
cd server
cp .env.example .env
```
At minimum, set `DATABASE_URL` and `JWT_SECRET`. You can generate a secret with:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

The other keys are **optional**. Each one turns on a feature, and you can leave it unset if you don't need that feature:

| Variable | Enables |
| --- | --- |
| `ANTHROPIC_API_KEY` | AI coach, photo, text and label logging, meal suggestions |
| `USDA_API_KEY` | Food search and barcode lookup |
| `NUTRITIONIX_APP_ID` / `NUTRITIONIX_API_KEY` | Restaurant menu nutrition |
| `GOOGLE_PLACES_API_KEY` | Nearby restaurants |
| `GOOGLE_CLIENT_ID` | Google Sign-In (also set `VITE_GOOGLE_CLIENT_ID` in `client/.env`) |
| `STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET` | Strava sync |

> **Tip:** Delete any lines you aren't using instead of leaving the `get_one_at_...` placeholder values in place.

### 4. Install and run
In one terminal:
```bash
cd server
npm install
npm run dev        # API on http://localhost:3001
```

In another terminal:
```bash
cd client
npm install
npm run dev        # App on http://localhost:5173
```

Open **http://localhost:5173** and create an account.

> In development, email verification and password reset links are printed to the server console rather than emailed.

---

## Project Structure

```
fittrack/
├── docker-compose.yml       # Postgres 16
├── client/                  # React + Vite frontend
│   ├── public/              # PWA manifest, service worker, icons
│   └── src/
│       ├── pages/           # Dashboard, Diary, Foods, Meals, Meal Plan, Scan,
│       │                    # Workouts, Fasting, Progress, Coach, Settings, auth pages
│       ├── components/      # UI building blocks (charts, scanner, timers, etc.)
│       ├── context/         # Auth context
│       └── lib/             # Body-fat, nutrient and strength-standard helpers
└── server/                  # Express API
    ├── db/schema.sql        # Database schema
    ├── bench/               # Food-lookup cache benchmark
    └── src/
        ├── routes/          # One router per feature (foods, logs, workouts, coach, ...)
        ├── middleware/      # Auth guard
        ├── expenditure.ts   # TDEE and calorie/macro target calculations
        └── usda.ts, strava.ts, nutritionix.ts, googlePlaces.ts, anthropic.ts
```

---

## API Overview

All endpoints live under `/api`. In development, Vite proxies `/api` to the Express server.

| Area | Routes |
| --- | --- |
| Auth & profile | `/auth`, `/profile` |
| Food | `/foods`, `/logs`, `/meals`, `/recipes`, `/meal-plan`, `/restaurants` |
| AI | `/coach`, `/photo-log`, `/text-log`, `/label-scan`, `/meal-suggest` |
| Tracking | `/workouts`, `/weight`, `/measurements`, `/progress-photos`, `/water`, `/sleep`, `/fasting` |
| Other | `/analytics`, `/notifications`, `/export`, `/strava`, `/health` |
