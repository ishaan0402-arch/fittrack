export type NutrientGroup = 'general' | 'carbs' | 'lipids' | 'protein' | 'vitamins' | 'minerals'

export interface NutrientDef {
  id: number
  label: string
  unit: string
  group: NutrientGroup
  /** FDA adult Daily Value (21 CFR 101.9) — a real reference intake, not a guess.
   *  Omitted where the FDA doesn't publish one (e.g. sugars, water). */
  dv?: number
}

export const NUTRIENT_DEFS: NutrientDef[] = [
  { id: 1051, label: 'Water', unit: 'g', group: 'general' },
  { id: 1057, label: 'Caffeine', unit: 'mg', group: 'general' },
  { id: 1018, label: 'Alcohol', unit: 'g', group: 'general' },

  { id: 1005, label: 'Carbs', unit: 'g', group: 'carbs', dv: 275 },
  { id: 1079, label: 'Fiber', unit: 'g', group: 'carbs', dv: 28 },
  { id: 2000, label: 'Sugars', unit: 'g', group: 'carbs' },
  { id: 1009, label: 'Starch', unit: 'g', group: 'carbs' },

  { id: 1004, label: 'Fat', unit: 'g', group: 'lipids', dv: 78 },
  { id: 1258, label: 'Saturated', unit: 'g', group: 'lipids', dv: 20 },
  { id: 1292, label: 'Monounsaturated', unit: 'g', group: 'lipids' },
  { id: 1293, label: 'Polyunsaturated', unit: 'g', group: 'lipids' },
  { id: 1257, label: 'Trans Fat', unit: 'g', group: 'lipids' },
  { id: 1253, label: 'Cholesterol', unit: 'mg', group: 'lipids', dv: 300 },

  { id: 1003, label: 'Protein', unit: 'g', group: 'protein', dv: 50 },

  { id: 1162, label: 'Vitamin C', unit: 'mg', group: 'vitamins', dv: 90 },
  { id: 1165, label: 'B1 (Thiamin)', unit: 'mg', group: 'vitamins', dv: 1.2 },
  { id: 1166, label: 'B2 (Riboflavin)', unit: 'mg', group: 'vitamins', dv: 1.3 },
  { id: 1167, label: 'B3 (Niacin)', unit: 'mg', group: 'vitamins', dv: 16 },
  { id: 1170, label: 'B5 (Pantothenic Acid)', unit: 'mg', group: 'vitamins', dv: 5 },
  { id: 1175, label: 'B6 (Pyridoxine)', unit: 'mg', group: 'vitamins', dv: 1.7 },
  { id: 1177, label: 'Folate', unit: 'µg', group: 'vitamins', dv: 400 },
  { id: 1178, label: 'B12 (Cobalamin)', unit: 'µg', group: 'vitamins', dv: 2.4 },
  { id: 1106, label: 'Vitamin A', unit: 'µg', group: 'vitamins', dv: 900 },
  { id: 1109, label: 'Vitamin E', unit: 'mg', group: 'vitamins', dv: 15 },
  { id: 1114, label: 'Vitamin D', unit: 'µg', group: 'vitamins', dv: 20 },
  { id: 1185, label: 'Vitamin K', unit: 'µg', group: 'vitamins', dv: 120 },

  { id: 1087, label: 'Calcium', unit: 'mg', group: 'minerals', dv: 1300 },
  { id: 1089, label: 'Iron', unit: 'mg', group: 'minerals', dv: 18 },
  { id: 1090, label: 'Magnesium', unit: 'mg', group: 'minerals', dv: 420 },
  { id: 1091, label: 'Phosphorus', unit: 'mg', group: 'minerals', dv: 1250 },
  { id: 1092, label: 'Potassium', unit: 'mg', group: 'minerals', dv: 4700 },
  { id: 1093, label: 'Sodium', unit: 'mg', group: 'minerals', dv: 2300 },
  { id: 1095, label: 'Zinc', unit: 'mg', group: 'minerals', dv: 11 },
  { id: 1098, label: 'Copper', unit: 'mg', group: 'minerals', dv: 0.9 },
  { id: 1101, label: 'Manganese', unit: 'mg', group: 'minerals', dv: 2.3 },
  { id: 1103, label: 'Selenium', unit: 'µg', group: 'minerals', dv: 55 },
]

export const NUTRIENT_GROUP_LABELS: Record<NutrientGroup, string> = {
  general: 'General',
  carbs: 'Carbohydrates',
  lipids: 'Lipids',
  protein: 'Protein',
  vitamins: 'Vitamins',
  minerals: 'Minerals',
}

export const NUTRIENT_GROUP_ORDER: NutrientGroup[] = [
  'general',
  'carbs',
  'lipids',
  'protein',
  'vitamins',
  'minerals',
]

// The headline row of rings — mirrors the "at a glance" set most food trackers lead with.
export const HEADLINE_NUTRIENT_IDS = [1079, 1089, 1087, 1106, 1162, 1178, 1177, 1092]
