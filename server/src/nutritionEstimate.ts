// Shared by the photo-log and text-log AI estimation routes — same output
// shape either way, only the input content (image vs description) differs.
export const NUTRITION_ESTIMATE_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          description: { type: "string" },
          estimatedQuantityGrams: { type: "number" },
          calories: { type: "number" },
          proteinG: { type: "number" },
          carbsG: { type: "number" },
          fatG: { type: "number" },
          note: { type: "string" },
        },
        required: [
          "description",
          "estimatedQuantityGrams",
          "calories",
          "proteinG",
          "carbsG",
          "fatG",
          "note",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
} as const;
