import { Router } from "express";
import multer from "multer";
import Anthropic from "@anthropic-ai/sdk";
import { asyncHandler } from "../asyncHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { anthropic } from "../anthropic.js";
import { NUTRITION_ESTIMATE_SCHEMA } from "../nutritionEstimate.js";
import { isSupportedMediaType } from "../imageMediaType.js";

// No disk storage — the photo is only ever sent to Claude for analysis, never
// persisted, so memory storage (discarded once the request completes) is enough.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!isSupportedMediaType(file.mimetype)) {
      cb(new Error("Please upload a JPEG, PNG, GIF, or WebP photo"));
      return;
    }
    cb(null, true);
  },
});

export const photoLogRouter = Router();
photoLogRouter.use(requireAuth);

const SYSTEM_PROMPT = `You are a nutrition estimation assistant built into FitTrack, a calorie-tracking app. You'll be shown a photo of food and must identify each distinct food item visible in it.

For each item, estimate:
- description: a short, plain-language name (e.g. "Grilled chicken breast", "White rice")
- estimatedQuantityGrams: a reasonable serving size in grams, based on the visible portion
- calories, proteinG, carbsG, fatG: nutrition for that exact quantity (not per 100g)
- note: a brief, honest caveat about your confidence (e.g. "estimated, roughly 1 cup" or "hard to judge the cut of meat")

Base estimates on typical preparation methods and visible portion size. If the photo doesn't show any food, return an empty items array rather than guessing.`;

photoLogRouter.post("/estimate", upload.single("photo"), asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "A photo file is required" });
    return;
  }
  if (!isSupportedMediaType(req.file.mimetype)) {
    res.status(400).json({ error: "Please upload a JPEG, PNG, GIF, or WebP photo" });
    return;
  }

  const base64Image = req.file.buffer.toString("base64");

  let response;
  try {
    response = await anthropic.messages.create({
      model: "claude-opus-5",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      output_config: { format: { type: "json_schema", schema: NUTRITION_ESTIMATE_SCHEMA } },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: req.file.mimetype,
                data: base64Image,
              },
            },
            { type: "text", text: "Estimate the nutrition for the food in this photo." },
          ],
        },
      ],
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      res.status(500).json({
        error: "AI photo logging isn't set up yet — add a real ANTHROPIC_API_KEY in server/.env.",
      });
      return;
    }
    throw err;
  }

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || !("text" in textBlock)) {
    res.status(502).json({ error: "The AI didn't return a usable estimate. Try another photo." });
    return;
  }

  res.json(JSON.parse(textBlock.text));
}));
