import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { CLIENT_ORIGIN, IS_PRODUCTION } from "./config.js";
import { generalLimiter, aiLimiter } from "./rateLimit.js";
import { foodsRouter } from "./routes/foods.js";
import { logsRouter } from "./routes/logs.js";
import { authRouter } from "./routes/auth.js";
import { profileRouter } from "./routes/profile.js";
import { coachRouter } from "./routes/coach.js";
import { weightRouter } from "./routes/weight.js";
import { mealsRouter } from "./routes/meals.js";
import { progressRouter } from "./routes/progress.js";
import { workoutsRouter } from "./routes/workouts.js";
import { notificationsRouter } from "./routes/notifications.js";
import { analyticsRouter } from "./routes/analytics.js";
import { restaurantsRouter } from "./routes/restaurants.js";
import { waterRouter } from "./routes/water.js";
import { measurementsRouter } from "./routes/measurements.js";
import { recipesRouter } from "./routes/recipes.js";
import { photoLogRouter } from "./routes/photoLog.js";
import { textLogRouter } from "./routes/textLog.js";
import { labelScanRouter } from "./routes/labelScan.js";
import { exportRouter } from "./routes/export.js";
import { fastingRouter } from "./routes/fasting.js";
import { mealSuggestRouter } from "./routes/mealSuggest.js";
import { stravaRouter } from "./routes/strava.js";
import { sleepRouter } from "./routes/sleep.js";
import { mealPlanRouter } from "./routes/mealPlan.js";

const app = express();
// Applies to this API's own JSON responses only (helmet doesn't touch the
// Vite-served client in dev). If this server ever serves the built client
// as static files too, its default CSP would need loosening for Google Fonts.
app.use(helmet());
app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(generalLimiter);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRouter);
app.use("/api/profile", profileRouter);
app.use("/api/foods", foodsRouter);
app.use("/api/logs", logsRouter);
app.use("/api/coach", aiLimiter, coachRouter);
app.use("/api/weight", weightRouter);
app.use("/api/meals", mealsRouter);
app.use("/api/progress-photos", progressRouter);
app.use("/api/workouts", workoutsRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/restaurants", restaurantsRouter);
app.use("/api/water", waterRouter);
app.use("/api/measurements", measurementsRouter);
app.use("/api/recipes", recipesRouter);
app.use("/api/photo-log", aiLimiter, photoLogRouter);
app.use("/api/text-log", aiLimiter, textLogRouter);
app.use("/api/label-scan", aiLimiter, labelScanRouter);
app.use("/api/export", exportRouter);
app.use("/api/fasting", fastingRouter);
app.use("/api/meal-suggest", aiLimiter, mealSuggestRouter);
app.use("/api/strava", stravaRouter);
app.use("/api/sleep", sleepRouter);
app.use("/api/meal-plan", mealPlanRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  // Full error detail (DB errors, file paths, stack traces) is only useful
  // to us in the server log — leaking it to the client in production hands
  // an attacker a map of the backend for free.
  res.status(500).json({ error: IS_PRODUCTION ? "Something went wrong." : err.message });
});

const port = process.env.PORT ?? 3001;
app.listen(port, () => {
  console.log(`FitTrack server listening on http://localhost:${port}`);
});
