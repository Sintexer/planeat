import type { MealFavorite } from '../../favorites/MealFavorite'
import type { RecipePairing } from '../../pairings/RecipePairing'
import type { Recipe } from '../../recipes/Recipe'
import type { SimpleFood } from '../../simpleFoods/SimpleFood'
import { addDays } from '../../shared/LocalDate'
import type { MealSlot } from '../MealSlot'
import {
  DEFAULT_GENERATION_HARD_POLICY,
  type FixedMeal,
  type GenerationHardPolicy,
} from './constraints'
import type { GenerationInput, GenerationLeftoverEvent } from './proposal'
import { DEFAULT_GENERATION_SOFT_PREFS } from './scoring'

export type QualityFixture = {
  name: string
  input: GenerationInput
}

export const QUALITY_SEEDS = [
  'seed-0',
  'seed-1',
  'seed-2',
  'seed-3',
  'seed-4',
  'seed-5',
  'seed-6',
  'seed-7',
] as const

const PLAN_ID = 'plan-quality'
const WEEK_START = '2026-01-05'
const SESSION = 'session-quality'

function completeRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'recipe-complete',
    name: 'Complete dinner',
    yield: { value: 4, unit: 'serving' },
    defaultPortionPerPerson: { value: 1, unit: 'serving' },
    ingredientLines: [],
    instructions: '',
    roles: ['complete'],
    mealTypes: ['dinner'],
    effort: 'regular',
    totalTimeMinutes: 40,
    reusePolicy: 'batch-friendly',
    freezerFriendly: false,
    tagIds: [],
    createdAt: 0,
    updatedAt: 10,
    ...overrides,
  }
}

function dinnerSlot(dayOffset: number, id = `slot-dinner-${dayOffset}`): MealSlot {
  return {
    id,
    planId: PLAN_ID,
    date: addDays(WEEK_START, dayOffset),
    mealType: 'dinner',
    excluded: false,
  }
}

function catalogs(
  recipes: readonly Recipe[],
  foods: readonly SimpleFood[] = [],
  extraIngredientIds: readonly string[] = [],
  extraTagIds: readonly string[] = [],
): GenerationInput['catalogs'] {
  const ingredientIds = new Set(extraIngredientIds)
  const tagIds = new Set(extraTagIds)
  for (const recipe of recipes) {
    for (const line of recipe.ingredientLines) {
      if (line.ingredientId) ingredientIds.add(line.ingredientId)
    }
    for (const tagId of recipe.tagIds) tagIds.add(tagId)
  }
  for (const food of foods) {
    ingredientIds.add(food.ingredientId)
    for (const tagId of food.tagIds) tagIds.add(tagId)
  }
  return {
    recipeIds: recipes.map((recipe) => recipe.id),
    tagIds: [...tagIds],
    ingredientIds: [...ingredientIds],
  }
}

function baseInput(
  recipes: readonly Recipe[],
  requested: readonly MealSlot[],
  overrides: Partial<GenerationInput> = {},
): GenerationInput {
  const { recipes: overrideRecipes, catalogs: catalogOverride, ...rest } = overrides
  const nextRecipes = overrideRecipes ?? recipes
  const foods = rest.simpleFoods ?? []
  return {
    planId: PLAN_ID,
    planRevision: 1,
    peopleCount: 2,
    requestedSlots: requested.map((slot) => ({ slot, componentCount: 0 })),
    seed: 'seed-1',
    policy: DEFAULT_GENERATION_HARD_POLICY,
    fixedMeals: [],
    softPrefs: DEFAULT_GENERATION_SOFT_PREFS,
    previousWeekRecipeIds: [],
    tagNamesById: {},
    generationSessionId: SESSION,
    ...rest,
    recipes: nextRecipes,
    catalogs: catalogOverride ?? catalogs(nextRecipes, foods),
  }
}

function incompleteCatalog(): GenerationInput {
  const side = completeRecipe({
    id: 'side-only',
    name: 'Side',
    roles: ['side'],
  })
  const breakfast = completeRecipe({
    id: 'breakfast-only',
    name: 'Oats',
    mealTypes: ['breakfast'],
  })
  const unknownTime = completeRecipe({
    id: 'untimed',
    name: 'Untimed stew',
    totalTimeMinutes: undefined,
  })
  const policy: GenerationHardPolicy = {
    ...DEFAULT_GENERATION_HARD_POLICY,
    unknownTimePolicy: 'exclude',
    maxTotalTimeMinutes: 30,
  }
  return baseInput([side, breakfast, unknownTime], [dinnerSlot(1)], { policy })
}

function largeSimilar(): GenerationInput {
  const recipes = Array.from({ length: 36 }, (_, index) =>
    completeRecipe({
      id: `dinner-${String(index).padStart(2, '0')}`,
      name: `Dinner ${index}`,
      effort: index % 5 === 0 ? 'demanding' : 'regular',
      totalTimeMinutes: 25 + (index % 20),
      updatedAt: 10 + index,
    }),
  )
  const slots = Array.from({ length: 7 }, (_, day) => dinnerSlot(day))
  return baseInput(recipes, slots)
}

function restrictiveIngredients(): GenerationInput {
  const tomato = completeRecipe({
    id: 'tomato-soup',
    name: 'Tomato soup',
    ingredientLines: [
      {
        ingredientId: 'ing-tomato',
        quantity: { value: 2, unit: 'piece' },
        displayText: 'tomato',
      },
    ],
  })
  const peanut = completeRecipe({
    id: 'peanut-stew',
    name: 'Peanut stew',
    ingredientLines: [
      {
        ingredientId: 'ing-peanut',
        quantity: { value: 50, unit: 'g' },
        displayText: 'peanut',
      },
    ],
  })
  const plain = completeRecipe({
    id: 'plain-rice',
    name: 'Rice',
    ingredientLines: [
      {
        ingredientId: 'ing-rice',
        quantity: { value: 100, unit: 'g' },
        displayText: 'rice',
      },
    ],
  })
  const policy: GenerationHardPolicy = {
    ...DEFAULT_GENERATION_HARD_POLICY,
    includeIngredientIds: ['ing-tomato'],
    excludeIngredientIds: ['ing-peanut'],
  }
  return baseInput([tomato, peanut, plain], [dinnerSlot(0), dinnerSlot(1), dinnerSlot(2)], {
    policy,
  })
}

function manyFixedMeals(): GenerationInput {
  const chili = completeRecipe({ id: 'chili', name: 'Chili' })
  const slots = Array.from({ length: 7 }, (_, day) => dinnerSlot(day))
  const fixedMeals: FixedMeal[] = slots.slice(0, 5).map((slot) => ({
    slotId: slot.id,
    date: slot.date,
    mealType: slot.mealType,
    recipeId: chili.id,
    recipe: chili,
  }))
  return baseInput([chili], slots.slice(5), { fixedMeals })
}

function batchWeek(maxExtraPlannedUses: 0 | 1): GenerationInput {
  const chili = completeRecipe({
    id: 'chili',
    name: 'Chili',
    yield: { value: 6, unit: 'serving' },
  })
  return baseInput([chili], [dinnerSlot(0, 'slot-mon'), dinnerSlot(1, 'slot-tue')], {
    batchPolicy: { maxExtraPlannedUses, unallocatedProduction: 'disallow' },
  })
}

function multiComponent(): GenerationInput {
  const cutlets = completeRecipe({
    id: 'cutlets',
    name: 'Cutlets',
    roles: ['main'],
  })
  const buckwheat = completeRecipe({
    id: 'buckwheat',
    name: 'Buckwheat',
    roles: ['side'],
  })
  const yogurt: SimpleFood = {
    id: 'yogurt',
    ingredientId: 'ing-yogurt',
    name: 'Yogurt',
    defaultPortion: { value: 1, unit: 'cup' },
    roles: ['complete'],
    mealTypes: ['dinner'],
    tagIds: [],
    enabledInSuggestions: true,
    createdAt: 0,
    updatedAt: 0,
  }
  const favorite: MealFavorite = {
    id: 'fav-cutlets',
    name: 'Cutlets and buckwheat',
    components: [
      {
        type: 'recipe',
        recipeId: 'cutlets',
        allocatedQuantity: { value: 2, unit: 'serving' },
      },
      {
        type: 'recipe',
        recipeId: 'buckwheat',
        allocatedQuantity: { value: 3, unit: 'serving' },
      },
    ],
    createdAt: 0,
    updatedAt: 1,
  }
  const pairing: RecipePairing = {
    id: 'pair-1',
    recipeId: 'cutlets',
    target: { type: 'recipe', id: 'buckwheat' },
    relationship: 'pairs-with',
  }
  const recipes = [cutlets, buckwheat]
  return baseInput(recipes, [dinnerSlot(1)], {
    simpleFoods: [yogurt],
    favorites: [favorite],
    pairings: [pairing],
  })
}

function reservedLeftovers(): GenerationInput {
  const chili = completeRecipe({ id: 'chili', name: 'Chili' })
  const leftover: GenerationLeftoverEvent = {
    id: 'event-chili',
    recipeId: chili.id,
    recipeName: chili.name,
    scheduledDate: WEEK_START,
    outputQuantity: { value: 6, unit: 'serving' },
    remaining: { value: 2, unit: 'serving' },
    desiredQuantity: { value: 2, unit: 'serving' },
    reusePolicy: 'batch-friendly',
    mealTypes: ['dinner'],
    recipe: chili,
  }
  return baseInput([], [dinnerSlot(1, 'slot-tue'), dinnerSlot(2, 'slot-wed')], {
    cookingEvents: [leftover],
    catalogs: { recipeIds: [chili.id], tagIds: [], ingredientIds: [] },
  })
}

export function qualityFixtures(): QualityFixture[] {
  return [
    { name: 'incompleteCatalog', input: incompleteCatalog() },
    { name: 'largeSimilar', input: largeSimilar() },
    { name: 'restrictiveIngredients', input: restrictiveIngredients() },
    { name: 'manyFixedMeals', input: manyFixedMeals() },
    { name: 'noLeftover', input: batchWeek(0) },
    { name: 'batchCooking', input: batchWeek(1) },
    { name: 'multiComponent', input: multiComponent() },
    { name: 'reservedLeftovers', input: reservedLeftovers() },
  ]
}

export function withQualitySeed(input: GenerationInput, seed: string): GenerationInput {
  return { ...input, seed }
}
