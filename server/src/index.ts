import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { foodsRouter } from "./routes/foods.js";
import { logsRouter } from "./routes/logs.js";
import { authRouter } from "./routes/auth.js";
import { profileRouter } from "./routes/profile.js";
import { coachRouter } from "./routes/coach.js";
import { weightRouter } from "./routes/weight.js";

const app = express();
app.use(cors());
app.use(express.json());
app.use(cookieParser());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRouter);
app.use("/api/profile", profileRouter);
app.use("/api/foods", foodsRouter);
app.use("/api/logs", logsRouter);
app.use("/api/coach", coachRouter);
app.use("/api/weight", weightRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

const port = process.env.PORT ?? 3001;
app.listen(port, () => {
  console.log(`FitTrack server listening on http://localhost:${port}`);
});
