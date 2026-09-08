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
