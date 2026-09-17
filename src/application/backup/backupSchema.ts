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
  quantityText: z.string().optional(),
  note: z.string().optional(),
  displayText: z.string(),
  sourceText: z.string().optional(),
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
  tagIds: z.array(z.string()),
  sourceUrl: z.string().optional(),
  photoUrl: z.string().optional(),
  cuisine: z.string().optional(),
  // Lenient (not z.enum(DISH_TYPES)) so a value outside the curated Select list —
  // legacy, hand-edited, or from a different build — always round-trips.
  dishType: z.string().optional(),
  maxPreferredRepeats: z.number().optional(),
  notes: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

/**
 * A frozen historical copy of a recipe, taken at cook time. `tags` holds label
 * strings as they were then, never live tag IDs, so a later tag rename can never
 * retroactively change what history shows — see domain `RecipeSnapshot`.
 */
const recipeSnapshotSchema = recipeSchema.omit({ tagIds: true }).extend({
  tags: z.array(z.string()),
})

// Lenient (not z.enum(UI_LOCALES)) so a locale outside the current build's
// list — legacy, future, or hand-edited — always round-trips.
const ingredientLabelSchema = z.object({
  locale: z.string(),
  label: z.string(),
})

const localizedAliasSchema = z.object({
  locale: z.string(),
  text: z.string(),
})

const ingredientSchema = z.object({
  id: z.string(),
  name: z.string(),
  aliases: z.array(z.string()),
  preferredLabels: z.array(ingredientLabelSchema).optional(),
  localizedAliases: z.array(localizedAliasSchema).optional(),
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
  tagIds: z.array(z.string()),
  enabledInSuggestions: z.boolean(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

const tagSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

const weekStartDaySchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
])

const settingsSchema = z.object({
  id: z.literal('app-settings'),
  householdSize: z.number(),
  weekStartDay: weekStartDaySchema,
  maxBatchPrepUnits: z.number(),
  preferredBatchPrepDays: z.array(weekStartDaySchema),
  quickMealsOnlyDays: z.array(weekStartDaySchema),
  avoidMultipleDemandingPreps: z.boolean(),
  favorVegetablesDaily: z.boolean(),
  uiLocale: z.enum(['en']).optional(),
  measurementPreference: z.enum(['as-entered', 'metric', 'us-customary']).optional(),
  catalogSort: z
    .enum(['relevance', 'name', 'recent-added', 'recent-edited', 'shortest-time'])
    .optional(),
  catalogGroup: z.enum(['none', 'kind', 'dish-type']).optional(),
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
  sessionId: z.string(),
  recipeId: z.string(),
  recipeSnapshot: recipeSnapshotSchema,
  outputQuantity: quantitySchema,
  scheduledDate: z.string(),
})

const prepSessionSchema = z.object({
  id: z.string(),
  planId: z.string(),
  date: z.string(),
  time: z.string().nullable().optional(),
  label: z.string().nullable().optional(),
})

const favoriteComponentSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('recipe'),
    recipeId: z.string(),
    allocatedQuantity: quantitySchema,
    role: z.enum(RECIPE_ROLES).optional(),
  }),
  z.object({
    type: z.literal('simple-food'),
    simpleFoodId: z.string(),
    allocatedQuantity: quantitySchema,
    role: z.enum(RECIPE_ROLES).optional(),
  }),
])

const mealFavoriteSchema = z.object({
  id: z.string(),
  name: z.string(),
  components: z.array(favoriteComponentSchema),
  createdAt: z.number(),
  updatedAt: z.number(),
})

const recipePairingSchema = z.object({
  id: z.string(),
  recipeId: z.string(),
  target: z.discriminatedUnion('type', [
    z.object({ type: z.literal('recipe'), id: z.string() }),
    z.object({ type: z.literal('simple-food'), id: z.string() }),
  ]),
  relationship: z.literal('pairs-with'),
})

const groceryListSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(['open', 'closed']),
  sourcePlanId: z.string().optional(),
  sourcePlanRevision: z.number().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

const groceryItemSchema = z.object({
  id: z.string(),
  listId: z.string(),
  label: z.string(),
  ingredientId: z.string().optional(),
  quantity: quantitySchema.nullable(),
  checked: z.boolean(),
  origin: z.enum(['generated', 'manual']),
  quantityManuallyEdited: z.boolean(),
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
      prepSessions: z.array(prepSessionSchema),
      groceryLists: z.array(groceryListSchema),
      groceryItems: z.array(groceryItemSchema),
      mealFavorites: z.array(mealFavoriteSchema),
      recipePairings: z.array(recipePairingSchema),
      tags: z.array(tagSchema),
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
  .refine(
    (backup) => {
      const ids = backup.data.groceryLists.map((list) => list.id)
      return new Set(ids).size === ids.length
    },
    { message: 'Backup contains duplicate grocery-list ids', path: ['data', 'groceryLists'] },
  )
  .refine(
    (backup) => {
      const ids = backup.data.groceryItems.map((item) => item.id)
      return new Set(ids).size === ids.length
    },
    { message: 'Backup contains duplicate grocery-item ids', path: ['data', 'groceryItems'] },
  )
  .refine(
    (backup) => {
      const ids = backup.data.prepSessions.map((session) => session.id)
      return new Set(ids).size === ids.length
    },
    { message: 'Backup contains duplicate prep-session ids', path: ['data', 'prepSessions'] },
  )
  .refine(
    (backup) => {
      const ids = backup.data.mealFavorites.map((favorite) => favorite.id)
      return new Set(ids).size === ids.length
    },
    { message: 'Backup contains duplicate meal-favorite ids', path: ['data', 'mealFavorites'] },
  )
  .refine(
    (backup) => {
      const ids = backup.data.recipePairings.map((pairing) => pairing.id)
      return new Set(ids).size === ids.length
    },
    { message: 'Backup contains duplicate recipe-pairing ids', path: ['data', 'recipePairings'] },
  )
  .refine(
    (backup) => {
      const ids = backup.data.tags.map((tag) => tag.id)
      return new Set(ids).size === ids.length
    },
    { message: 'Backup contains duplicate tag ids', path: ['data', 'tags'] },
  )

/** Re-export for UI selects that want the same unit list as validation awareness. */
export { QUANTITY_UNITS }
