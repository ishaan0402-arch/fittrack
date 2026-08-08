import { Router } from "express";
import multer from "multer";
import Anthropic from "@anthropic-ai/sdk";
import { asyncHandler } from "../asyncHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { anthropic } from "../anthropic.js";
import { isSupportedMediaType } from "../imageMediaType.js";

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

export const labelScanRouter = Router();
labelScanRouter.use(requireAuth);

// A single-product read, not an estimate — the schema mirrors what's printed
// on a Nutrition Facts panel rather than the multi-item shape used for a
// plate of food (see nutritionEstimate.ts).
const LABEL_SCAN_SCHEMA = {
  type: "object",
  properties: {
    labelFound: { type: "boolean" },
    productName: { type: "string" },
    servingSizeDescription: { type: "string" },
    servingSizeGrams: { type: "number" },
    caloriesPerServing: { type: "number" },
    proteinG: { type: "number" },
    carbsG: { type: "number" },
    fatG: { type: "number" },
    note: { type: "string" },
  },
  required: [
    "labelFound",
    "productName",
    "servingSizeDescription",
    "servingSizeGrams",
    "caloriesPerServing",
    "proteinG",
    "carbsG",
    "fatG",
    "note",
  ],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `You are a nutrition label reader built into FitTrack, a calorie-tracking app. You'll be shown a photo of a food package, ideally its Nutrition Facts label.

Read the label precisely and extract:
- productName: the product's name from the packaging if visible, otherwise a short generic description
- servingSizeDescription: the serving size exactly as printed (e.g. "2 cookies (30g)", "1 cup (240mL)")
- servingSizeGrams: that serving size converted to grams — estimate a reasonable gram equivalent if the label only gives a volume or count
- caloriesPerServing, proteinG, carbsG, fatG: the values printed for that exact serving size (not per 100g)
- note: a brief caveat if anything was hard to read or had to be estimated

Report the label's printed numbers exactly — don't round or adjust them. If you can clearly see a Nutrition Facts label, set labelFound to true. If there's no readable nutrition label in the photo, set labelFound to false, use 0 for every number and an empty string for the other text fields, and explain why in note — never guess nutrition values without a label to read them from.`;

labelScanRouter.post("/scan", upload.single("photo"), asyncHandler(async (req, res) => {
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
      output_config: { format: { type: "json_schema", schema: LABEL_SCAN_SCHEMA } },
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
            { type: "text", text: "Read the nutrition label in this photo." },
          ],
        },
      ],
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      res.status(500).json({
        error: "AI label scanning isn't set up yet — add a real ANTHROPIC_API_KEY in server/.env.",
      });
      return;
    }
    throw err;
  }

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || !("text" in textBlock)) {
    res.status(502).json({ error: "The AI didn't return a usable read. Try another photo." });
    return;
  }

  res.json(JSON.parse(textBlock.text));
}));
