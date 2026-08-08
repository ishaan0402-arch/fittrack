import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { pool } from "../db.js";
import { asyncHandler } from "../asyncHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { anthropic } from "../anthropic.js";
import { localDateString } from "../dateUtils.js";
import {
  estimateExpenditure,
  calorieTargetForGoal,
  macroTargetsForGoal,
  GOAL_LABELS,
  type ActivityLevel,
  type Gender,
  type Goal,
} from "../expenditure.js";

export const coachRouter = Router();
coachRouter.use(requireAuth);

// How many prior messages to send back to the model as conversation history.
const HISTORY_LIMIT = 20;

async function buildContext(userId: number): Promise<string> {
  const profileResult = await pool.query(
    "SELECT height_cm, weight_kg, gender, age, activity_level, goal FROM user_profiles WHERE user_id = $1",
    [userId]
  );

  let profileContext = "The user hasn't completed their health profile yet.";
  let expenditure: number | null = null;

  if (profileResult.rows.length > 0) {
    const p = profileResult.rows[0];
    const heightCm = Number(p.height_cm);
    const weightKg = Number(p.weight_kg);
    const goal = p.goal as Goal;
    expenditure = estimateExpenditure({
      heightCm,
      weightKg,
      age: p.age,
      gender: p.gender as Gender,
      activityLevel: p.activity_level as ActivityLevel,
    });
    const calorieTarget = calorieTargetForGoal(expenditure, goal);
    const macros = macroTargetsForGoal(weightKg, goal, calorieTarget);
    profileContext = `User profile: ${p.gender}, age ${p.age}, height ${heightCm}cm, weight ${weightKg}kg, activity level "${p.activity_level}". Goal: ${GOAL_LABELS[goal]}. Estimated maintenance calories (TDEE, Mifflin-St Jeor): ${expenditure} kcal. Goal-adjusted daily target: ${calorieTarget} kcal, with ${macros.protein}g protein / ${macros.carbs}g carbs / ${macros.fat}g fat. Tailor advice to this goal (e.g. emphasize a calorie surplus and progressive overload for bulk/bodybuilding/powerlifting, a deficit with high protein for cut, strength/technique cues for powerlifting).`;
    expenditure = calorieTarget;
  }

  const today = localDateString();
  const logResult = await pool.query(
    `SELECT f.description, l.quantity_grams, ROUND(f.calories_per_100g * l.quantity_grams / 100, 1) AS calories
     FROM food_logs l
     JOIN foods f ON f.id = l.food_id
     WHERE l.user_id = $1 AND l.logged_at::date = $2::date
     ORDER BY l.logged_at ASC`,
    [userId, today]
  );

  const totalCalories = logResult.rows.reduce((sum, row) => sum + Number(row.calories), 0);
  const logLines =
    logResult.rows.length > 0
      ? logResult.rows
          .map((r) => `- ${r.description} (${r.quantity_grams}g): ${r.calories} kcal`)
          .join("\n")
      : "Nothing logged yet today.";

  const targetNote = expenditure ? ` out of an estimated ${expenditure} kcal target` : "";

  return `${profileContext}

Today's food log (${today}):
${logLines}

Total consumed today: ${Math.round(totalCalories * 10) / 10} kcal${targetNote}.`;
}

coachRouter.get("/messages", asyncHandler(async (req, res) => {
  const result = await pool.query(
    "SELECT id, role, content, created_at FROM coach_messages WHERE user_id = $1 ORDER BY created_at ASC",
    [req.userId]
  );
  res.json(result.rows);
}));

coachRouter.post("/messages", asyncHandler(async (req, res) => {
  const { message } = req.body as { message?: string };
  if (!message || !message.trim()) {
    res.status(400).json({ error: "message is required" });
    return;
  }

  await pool.query("INSERT INTO coach_messages (user_id, role, content) VALUES ($1, 'user', $2)", [
    req.userId,
    message.trim(),
  ]);

  const dataContext = await buildContext(req.userId!);

  const systemPrompt = `You are the personal fitness and nutrition coach built into FitTrack, a calorie-tracking app. You're knowledgeable about nutrition science, exercise physiology, and behavior change, and you're warm and motivating without being saccharine or preachy.

You have the user's real data below — use it naturally (e.g. reference their actual calorie total or how close they are to their target) instead of asking them to repeat information you already have. Keep responses conversational and concise; this is a chat, not an essay. Never fabricate data you weren't given.

${dataContext}`;

  const historyResult = await pool.query(
    "SELECT role, content FROM coach_messages WHERE user_id = $1 ORDER BY created_at ASC LIMIT $2",
    [req.userId, HISTORY_LIMIT]
  );

  let response;
  try {
    response = await anthropic.messages.create({
      model: "claude-opus-5",
      max_tokens: 1024,
      system: systemPrompt,
      messages: historyResult.rows.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content as string,
      })),
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      res.status(500).json({
        error: "The AI coach isn't set up yet — add a real ANTHROPIC_API_KEY in server/.env.",
      });
      return;
    }
    throw err;
  }

  const textBlock = response.content.find((b) => b.type === "text");
  const reply = textBlock && "text" in textBlock ? textBlock.text : "Sorry, I couldn't come up with a response just now.";

  const inserted = await pool.query(
    `INSERT INTO coach_messages (user_id, role, content) VALUES ($1, 'assistant', $2)
     RETURNING id, role, content, created_at`,
    [req.userId, reply]
  );

  res.status(201).json(inserted.rows[0]);
}));
