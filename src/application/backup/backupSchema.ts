import { z } from 'zod'
import {
  EFFORT_LEVELS,
  MEAL_TYPES,
  RECIPE_ROLES,
  REUSE_POLICIES,
} from '../../domain/shared/MealEnums'
import { QUANTITY_UNITS } from '../../domain/shared/Quantity'

const quantitySchema = z.object({
  value: z.number(),
  unit: z.string(),
})

const recipeIngredientLineSchema = z.object({
  ingredientId: z.string(),
  quantity: quantitySchema.nullable(),
  note: z.string().optional(),
  displayText: z.string(),
})

const recipeSchema = z.object({
  id: z.string(),
  name: z.string(),
  yield: quantitySchema,
  defaultPortionPerPerson: quantitySchema,
  ingredientLines: z.array(recipeIngredientLineSchema),
  instructions: z.string(),
  roles: z.array(z.enum(RECIPE_ROLES)),
  mealTypes: z.array(z.enum(MEAL_TYPES)),
  effort: z.enum(EFFORT_LEVELS),
  activeTimeMinutes: z.number().optional(),
  totalTimeMinutes: z.number().optional(),
  reusePolicy: z.enum(REUSE_POLICIES),
  freezerFriendly: z.boolean(),
  freezingNotes: z.string().optional(),
  tags: z.array(z.string()),
  sourceUrl: z.string().optional(),
  cuisine: z.string().optional(),
  maxPreferredRepeats: z.number().optional(),
  notes: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

const ingredientSchema = z.object({
  id: z.string(),
  name: z.string(),
  aliases: z.array(z.string()),
  category: z.string().optional(),
  isCommon: z.boolean(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

const simpleFoodSchema = z.object({
  id: z.string(),
  ingredientId: z.string(),
  name: z.string(),
  defaultPortion: quantitySchema,
  roles: z.array(z.enum(RECIPE_ROLES)),
  mealTypes: z.array(z.enum(MEAL_TYPES)),
  tags: z.array(z.string()),
  enabledInSuggestions: z.boolean(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

const settingsSchema = z.object({
  id: z.literal('app-settings'),
  householdSize: z.number(),
})

export const backupFileSchema = z
  .object({
    format: z.literal('family-menu-planner'),
    schemaVersion: z.number(),
    exportedAt: z.string(),
    data: z.object({
      recipes: z.array(recipeSchema),
      settings: z.array(settingsSchema),
      ingredients: z.array(ingredientSchema),
      simpleFoods: z.array(simpleFoodSchema),
    }),
  })
  .refine(
    (backup) => {
      const ids = backup.data.recipes.map((recipe) => recipe.id)
      return new Set(ids).size === ids.length
    },
    { message: 'Backup contains duplicate recipe ids', path: ['data', 'recipes'] },
  )
  .refine(
    (backup) => {
      const ids = backup.data.ingredients.map((ingredient) => ingredient.id)
      return new Set(ids).size === ids.length
    },
    { message: 'Backup contains duplicate ingredient ids', path: ['data', 'ingredients'] },
  )
  .refine(
    (backup) => {
      const ids = backup.data.simpleFoods.map((simpleFood) => simpleFood.id)
      return new Set(ids).size === ids.length
    },
    { message: 'Backup contains duplicate simple-food ids', path: ['data', 'simpleFoods'] },
  )

/** Re-export for UI selects that want the same unit list as validation awareness. */
export { QUANTITY_UNITS }
