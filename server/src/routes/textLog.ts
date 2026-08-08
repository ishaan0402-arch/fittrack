import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { asyncHandler } from "../asyncHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { anthropic } from "../anthropic.js";
import { NUTRITION_ESTIMATE_SCHEMA } from "../nutritionEstimate.js";

export const textLogRouter = Router();
textLogRouter.use(requireAuth);

const SYSTEM_PROMPT = `You are a nutrition estimation assistant built into FitTrack, a calorie-tracking app. The user will describe in plain language what they ate, and you must identify each distinct food item mentioned.

For each item, estimate:
- description: a short, plain-language name (e.g. "Grilled chicken sandwich", "Side salad")
- estimatedQuantityGrams: a reasonable serving size in grams, based on what's typical for that food unless the user gave a specific amount
- calories, proteinG, carbsG, fatG: nutrition for that exact quantity (not per 100g)
- note: a brief, honest caveat about your confidence (e.g. "estimated, standard restaurant portion" or "assumed no dressing")

If the user specifies a quantity or brand (e.g. "2 slices", "a Big Mac"), use that instead of guessing. If the text doesn't describe any food, return an empty items array rather than guessing.`;

textLogRouter.post("/estimate", asyncHandler(async (req, res) => {
  const { description } = req.body as { description?: string };
  if (!description || !description.trim()) {
    res.status(400).json({ error: "A description of what you ate is required" });
    return;
  }

  let response;
  try {
    response = await anthropic.messages.create({
      model: "claude-opus-5",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      output_config: { format: { type: "json_schema", schema: NUTRITION_ESTIMATE_SCHEMA } },
      messages: [{ role: "user", content: description.trim() }],
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      res.status(500).json({
        error: "AI food logging isn't set up yet — add a real ANTHROPIC_API_KEY in server/.env.",
      });
      return;
    }
    throw err;
  }

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || !("text" in textBlock)) {
    res.status(502).json({ error: "The AI didn't return a usable estimate. Try rewording it." });
    return;
  }

  res.json(JSON.parse(textBlock.text));
}));
