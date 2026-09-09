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
  weekStartDay: z.union([
    z.literal(0),
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.literal(6),
  ]),
})

const planSchema = z.object({
  id: z.string(),
  startDate: z.string(),
  dayCount: z.literal(7),
  peopleCount: z.number(),
  revision: z.number(),
  preferences: z.object({}),
  createdAt: z.number(),
  updatedAt: z.number(),
})

const mealSlotSchema = z.object({
  id: z.string(),
  planId: z.string(),
  date: z.string(),
  mealType: z.enum(MEAL_TYPES),
  excluded: z.boolean(),
  note: z.string().optional(),
})

const componentSourceSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('cooking-event'),
    cookingEventId: z.string(),
  }),
  z.object({
    type: z.literal('simple-food'),
    simpleFoodId: z.string(),
  }),
])

const mealComponentSchema = z.object({
  id: z.string(),
  slotId: z.string(),
  source: componentSourceSchema,
  allocatedQuantity: quantitySchema,
  role: z.enum(RECIPE_ROLES).optional(),
})

const cookingEventSchema = z.object({
  id: z.string(),
  planId: z.string(),
  sessionId: z.null(),
  recipeId: z.string(),
  recipeSnapshot: recipeSchema,
  outputQuantity: quantitySchema,
  scheduledDate: z.string(),
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
      plans: z.array(planSchema),
      mealSlots: z.array(mealSlotSchema),
      mealComponents: z.array(mealComponentSchema),
      cookingEvents: z.array(cookingEventSchema),
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
  .refine(
    (backup) => {
      const ids = backup.data.plans.map((plan) => plan.id)
      return new Set(ids).size === ids.length
    },
    { message: 'Backup contains duplicate plan ids', path: ['data', 'plans'] },
  )

/** Re-export for UI selects that want the same unit list as validation awareness. */
export { QUANTITY_UNITS }
