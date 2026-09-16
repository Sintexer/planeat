export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner'] as const
export type MealType = (typeof MEAL_TYPES)[number]

export const RECIPE_ROLES = [
  'complete',
  'main',
  'side',
  'vegetable',
  'breakfast-component',
] as const
export type RecipeRole = (typeof RECIPE_ROLES)[number]

export const EFFORT_LEVELS = ['quick', 'regular', 'demanding'] as const
export type Effort = (typeof EFFORT_LEVELS)[number]

export const REUSE_POLICIES = ['fresh-only', 'same-day', 'batch-friendly'] as const
export type ReusePolicy = (typeof REUSE_POLICIES)[number]

/**
 * Curated suggestions for the "primary dish type" Select. UI-facing only —
 * `Recipe.dishType` is stored as a plain string so an unrecognized value
 * (removed option, hand-edited data, older/newer build) always round-trips.
 */
export const DISH_TYPES = [
  'soup',
  'salad',
  'stew',
  'casserole',
  'pasta',
  'roast',
  'grill',
  'sandwich',
  'baked-good',
  'dessert',
  'side-dish',
  'other',
] as const
export type DishType = (typeof DISH_TYPES)[number]

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
}

export const RECIPE_ROLE_LABELS: Record<RecipeRole, string> = {
  complete: 'Complete dish',
  main: 'Main',
  side: 'Side',
  vegetable: 'Vegetable accompaniment',
  'breakfast-component': 'Breakfast component',
}

export const EFFORT_LABELS: Record<Effort, string> = {
  quick: 'Quick',
  regular: 'Regular',
  demanding: 'Demanding',
}

export const REUSE_POLICY_LABELS: Record<ReusePolicy, string> = {
  'fresh-only': 'Fresh only',
  'same-day': 'Same day',
  'batch-friendly': 'Batch-friendly',
}

export const DISH_TYPE_LABELS: Record<DishType, string> = {
  soup: 'Soup',
  salad: 'Salad',
  stew: 'Stew',
  casserole: 'Casserole',
  pasta: 'Pasta',
  roast: 'Roast',
  grill: 'Grill',
  sandwich: 'Sandwich',
  'baked-good': 'Baked good',
  dessert: 'Dessert',
  'side-dish': 'Side dish',
  other: 'Other',
}
