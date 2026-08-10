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
  type ActivityLevel,
  type Gender,
  type Goal,
} from "../expenditure.js";

export const mealSuggestRouter = Router();
mealSuggestRouter.use(requireAuth);

// Structured output for the "What should I eat?" one-tap suggester — Claude
// proposes 2-3 real, specific meals/snacks sized to fit whatever calorie and
// macro budget is left today, each ready to log directly (same shape as the
// AI text/photo logging items, but with a "reason" instead of a "note").
const MEAL_SUGGESTION_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          quantityGrams: { type: "number" },
          calories: { type: "number" },
          proteinG: { type: "number" },
          carbsG: { type: "number" },
          fatG: { type: "number" },
          reason: { type: "string" },
        },
        required: ["name", "quantityGrams", "calories", "proteinG", "carbsG", "fatG", "reason"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
} as const;

mealSuggestRouter.post("/suggest", asyncHandler(async (req, res) => {
  const profileResult = await pool.query(
    "SELECT weight_kg, gender, height_cm, age, activity_level, goal FROM user_profiles WHERE user_id = $1",
    [req.userId]
  );
  if (profileResult.rows.length === 0) {
    res.status(400).json({ error: "Complete your health profile first to get suggestions." });
    return;
  }
  const p = profileResult.rows[0];
  const weightKg = Number(p.weight_kg);
  const goal = p.goal as Goal;
  const expenditure = estimateExpenditure({
    heightCm: Number(p.height_cm),
    weightKg,
    age: p.age,
    gender: p.gender as Gender,
    activityLevel: p.activity_level as ActivityLevel,
  });
  const calorieTarget = calorieTargetForGoal(expenditure, goal);
  const macroTargets = macroTargetsForGoal(weightKg, goal, calorieTarget);

  const today = localDateString();
  const totalsResult = await pool.query(
    `SELECT
       COALESCE(ROUND(SUM(f.calories_per_100g * l.quantity_grams / 100), 1), 0) AS calories,
       COALESCE(ROUND(SUM(f.protein_per_100g * l.quantity_grams / 100), 1), 0) AS protein,
       COALESCE(ROUND(SUM(f.carbs_per_100g * l.quantity_grams / 100), 1), 0) AS carbs,
       COALESCE(ROUND(SUM(f.fat_per_100g * l.quantity_grams / 100), 1), 0) AS fat
     FROM food_logs l
     JOIN foods f ON f.id = l.food_id
     WHERE l.user_id = $1 AND l.logged_at::date = $2::date`,
    [req.userId, today]
  );
  const consumed = totalsResult.rows[0];

  const remaining = {
    calories: Math.max(0, Math.round(calorieTarget - Number(consumed.calories))),
    protein: Math.max(0, Math.round(macroTargets.protein - Number(consumed.protein))),
    carbs: Math.max(0, Math.round(macroTargets.carbs - Number(consumed.carbs))),
    fat: Math.max(0, Math.round(macroTargets.fat - Number(consumed.fat))),
  };

  const systemPrompt = `You are the meal-suggestion engine built into FitTrack, a calorie-tracking app. A user has tapped "What should I eat?" and wants 2-3 specific, realistic, ready-to-log meal or snack ideas that fit the exact remaining calorie/macro budget below for the rest of today. Goal: ${goal}.

Remaining today: ${remaining.calories} kcal, ${remaining.protein}g protein, ${remaining.carbs}g carbs, ${remaining.fat}g fat.

Suggest real, common foods or simple home-cookable meals (not brand-specific products unless iconic and simple, e.g. "Greek yogurt with berries", "grilled chicken breast with rice and broccoli"). Each suggestion's calories/macros must be a realistic estimate for the quantityGrams given, and should use up a meaningful share of what's remaining without wildly exceeding it. Vary the suggestions (don't propose three similar things). The "reason" field should be a short (under 15 words) explanation of why it fits (e.g. "high protein, fits your remaining budget closely").`;

  let response;
  try {
    response = await anthropic.messages.create({
      model: "claude-opus-5",
      max_tokens: 2048,
      system: systemPrompt,
      output_config: { format: { type: "json_schema", schema: MEAL_SUGGESTION_SCHEMA } },
      messages: [{ role: "user", content: "What should I eat?" }],
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      res.status(500).json({
        error: "AI meal suggestions aren't set up yet — add a real ANTHROPIC_API_KEY in server/.env.",
      });
      return;
    }
    throw err;
  }

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || !("text" in textBlock)) {
    res.status(502).json({ error: "The AI didn't return usable suggestions. Try again." });
    return;
  }

  const parsed = JSON.parse(textBlock.text);
  res.json({ remaining, items: parsed.items });
}));
