import type { Ingredient } from '../../../domain/ingredients/Ingredient'
import type { Recipe } from '../../../domain/recipes/Recipe'
import type { SimpleFood } from '../../../domain/simpleFoods/SimpleFood'
import type { Tag } from '../../../domain/tags/Tag'

/** Stable ids so seed rows are deterministic across installs. */
export const SEED_INGREDIENT_IDS = {
  chicken: 'seed-ing-chicken',
  onion: 'seed-ing-onion',
  egg: 'seed-ing-egg',
  breadcrumbs: 'seed-ing-breadcrumbs',
  salt: 'seed-ing-salt',
  pepper: 'seed-ing-pepper',
  oil: 'seed-ing-oil',
  carrot: 'seed-ing-carrot',
  potato: 'seed-ing-potato',
  pasta: 'seed-ing-pasta',
  bacon: 'seed-ing-bacon',
  parmesan: 'seed-ing-parmesan',
  garlic: 'seed-ing-garlic',
  rice: 'seed-ing-rice',
  buckwheat: 'seed-ing-buckwheat',
  bread: 'seed-ing-bread',
  yogurt: 'seed-ing-yogurt',
  banana: 'seed-ing-banana',
} as const

export const SEED_RECIPE_IDS = {
  cutlets: 'seed-recipe-cutlets',
  soup: 'seed-recipe-soup',
  carbonara: 'seed-recipe-carbonara',
  rice: 'seed-recipe-rice',
  buckwheat: 'seed-recipe-buckwheat',
  potatoes: 'seed-recipe-potatoes',
} as const

export const SEED_SIMPLE_FOOD_IDS = {
  bread: 'seed-sf-bread',
  yogurt: 'seed-sf-yogurt',
  banana: 'seed-sf-banana',
} as const

export const SEED_TAG_IDS = {
  batch: 'seed-tag-batch',
  soup: 'seed-tag-soup',
  vegetable: 'seed-tag-vegetable',
  pasta: 'seed-tag-pasta',
  italian: 'seed-tag-italian',
  side: 'seed-tag-side',
} as const

function line(
  ingredientId: string,
  name: string,
  value: number,
  unit: string,
  note?: string,
): Recipe['ingredientLines'][number] {
  return {
    ingredientId,
    quantity: { value, unit },
    note,
    displayText: note ? `${value} ${unit} ${name}, ${note}` : `${value} ${unit} ${name}`,
  }
}

/**
 * Starter library used only when the recipes table is empty.
 * Timestamps are filled at seed time by `seedStarterLibraryIfEmpty`.
 */
export function buildStarterCatalog(now: number): {
  ingredients: Ingredient[]
  recipes: Recipe[]
  simpleFoods: SimpleFood[]
  tags: Tag[]
} {
  const ids = SEED_INGREDIENT_IDS
  const tagIds = SEED_TAG_IDS

  const tags: Tag[] = [
    { id: tagIds.batch, name: 'batch', createdAt: now, updatedAt: now },
    { id: tagIds.soup, name: 'soup', createdAt: now, updatedAt: now },
    { id: tagIds.vegetable, name: 'vegetable', createdAt: now, updatedAt: now },
    { id: tagIds.pasta, name: 'pasta', createdAt: now, updatedAt: now },
    { id: tagIds.italian, name: 'italian', createdAt: now, updatedAt: now },
    { id: tagIds.side, name: 'side', createdAt: now, updatedAt: now },
  ]

  const ingredients: Ingredient[] = [
    {
      id: ids.chicken,
      name: 'Chicken',
      aliases: ['chicken breast', 'minced chicken'],
      category: 'meat',
      isCommon: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: ids.onion,
      name: 'Onion',
      aliases: [],
      category: 'produce',
      isCommon: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: ids.egg,
      name: 'Egg',
      aliases: ['eggs'],
      category: 'dairy',
      isCommon: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: ids.breadcrumbs,
      name: 'Breadcrumbs',
      aliases: [],
      category: 'pantry',
      isCommon: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: ids.salt,
      name: 'Salt',
      aliases: [],
      category: 'pantry',
      isCommon: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: ids.pepper,
      name: 'Black pepper',
      aliases: ['pepper'],
      category: 'pantry',
      isCommon: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: ids.oil,
      name: 'Cooking oil',
      aliases: ['oil', 'vegetable oil'],
      category: 'pantry',
      isCommon: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: ids.carrot,
      name: 'Carrot',
      aliases: [],
      category: 'produce',
      isCommon: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: ids.potato,
      name: 'Potato',
      aliases: ['potatoes'],
      category: 'produce',
      isCommon: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: ids.pasta,
      name: 'Spaghetti',
      aliases: ['pasta'],
      category: 'pantry',
      isCommon: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: ids.bacon,
      name: 'Bacon',
      aliases: ['guanciale', 'pancetta'],
      category: 'meat',
      isCommon: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: ids.parmesan,
      name: 'Parmesan',
      aliases: ['pecorino', 'parmigiano'],
      category: 'dairy',
      isCommon: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: ids.garlic,
      name: 'Garlic',
      aliases: [],
      category: 'produce',
      isCommon: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: ids.rice,
      name: 'Rice',
      aliases: [],
      category: 'pantry',
      isCommon: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: ids.buckwheat,
      name: 'Buckwheat',
      aliases: ['kasha'],
      category: 'pantry',
      isCommon: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: ids.bread,
      name: 'Bread',
      aliases: [],
      category: 'bakery',
      isCommon: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: ids.yogurt,
      name: 'Yogurt',
      aliases: ['yoghurt'],
      category: 'dairy',
      isCommon: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: ids.banana,
      name: 'Banana',
      aliases: [],
      category: 'produce',
      isCommon: false,
      createdAt: now,
      updatedAt: now,
    },
  ]

  const recipes: Recipe[] = [
    {
      id: SEED_RECIPE_IDS.cutlets,
      name: 'Chicken cutlets',
      yield: { value: 12, unit: 'piece' },
      defaultPortionPerPerson: { value: 3, unit: 'piece' },
      ingredientLines: [
        line(ids.chicken, 'chicken', 600, 'g', 'minced'),
        line(ids.onion, 'onion', 1, 'piece'),
        line(ids.egg, 'egg', 1, 'piece'),
        line(ids.breadcrumbs, 'breadcrumbs', 80, 'g'),
        line(ids.salt, 'salt', 1, 'tsp'),
        line(ids.pepper, 'black pepper', 0.5, 'tsp'),
        line(ids.oil, 'cooking oil', 2, 'tbsp', 'for frying'),
      ],
      instructions:
        'Mix minced chicken with grated onion, egg, salt, and pepper. Shape into cutlets, coat in breadcrumbs, and fry in oil until golden and cooked through.',
      roles: ['main'],
      mealTypes: ['lunch', 'dinner'],
      effort: 'regular',
      activeTimeMinutes: 30,
      totalTimeMinutes: 45,
      reusePolicy: 'batch-friendly',
      freezerFriendly: true,
      freezingNotes: 'Freeze cooked cutlets; reheat in oven or pan.',
      tagIds: [tagIds.batch],
      cuisine: 'home',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: SEED_RECIPE_IDS.soup,
      name: 'Vegetable soup',
      yield: { value: 6, unit: 'serving' },
      defaultPortionPerPerson: { value: 1, unit: 'serving' },
      ingredientLines: [
        line(ids.onion, 'onion', 1, 'piece'),
        line(ids.carrot, 'carrot', 2, 'piece'),
        line(ids.potato, 'potato', 3, 'piece'),
        line(ids.salt, 'salt', 1, 'tsp'),
        line(ids.pepper, 'black pepper', 0.5, 'tsp'),
        line(ids.oil, 'cooking oil', 1, 'tbsp'),
      ],
      instructions:
        'Sauté onion and carrot in oil. Add cubed potatoes and water to cover. Simmer until soft, season with salt and pepper. Blend partly if you prefer a thicker soup.',
      roles: ['complete'],
      mealTypes: ['lunch', 'dinner'],
      effort: 'regular',
      activeTimeMinutes: 20,
      totalTimeMinutes: 40,
      reusePolicy: 'batch-friendly',
      freezerFriendly: true,
      tagIds: [tagIds.soup, tagIds.vegetable],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: SEED_RECIPE_IDS.carbonara,
      name: 'Carbonara',
      yield: { value: 2, unit: 'serving' },
      defaultPortionPerPerson: { value: 1, unit: 'serving' },
      ingredientLines: [
        line(ids.pasta, 'spaghetti', 200, 'g'),
        line(ids.bacon, 'bacon', 100, 'g'),
        line(ids.egg, 'egg', 2, 'piece'),
        line(ids.parmesan, 'parmesan', 40, 'g', 'grated'),
        line(ids.garlic, 'garlic', 1, 'piece', 'optional'),
        line(ids.pepper, 'black pepper', 1, 'tsp'),
        line(ids.salt, 'salt', 1, 'tsp', 'for pasta water'),
      ],
      instructions:
        'Cook pasta in salted water. Crisp bacon (with garlic if using). Whisk eggs with Parmesan and pepper. Toss hot drained pasta with bacon off heat, then egg mixture until creamy. Serve immediately.',
      roles: ['complete'],
      mealTypes: ['lunch', 'dinner'],
      effort: 'quick',
      activeTimeMinutes: 20,
      totalTimeMinutes: 25,
      reusePolicy: 'fresh-only',
      freezerFriendly: false,
      tagIds: [tagIds.pasta, tagIds.italian],
      cuisine: 'italian',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: SEED_RECIPE_IDS.rice,
      name: 'Plain rice',
      yield: { value: 4, unit: 'serving' },
      defaultPortionPerPerson: { value: 1, unit: 'serving' },
      ingredientLines: [line(ids.rice, 'rice', 300, 'g'), line(ids.salt, 'salt', 0.5, 'tsp')],
      instructions:
        'Rinse rice. Cook with salt in water or a rice cooker until tender. Fluff and serve.',
      roles: ['side'],
      mealTypes: ['lunch', 'dinner'],
      effort: 'quick',
      activeTimeMinutes: 5,
      totalTimeMinutes: 25,
      reusePolicy: 'same-day',
      freezerFriendly: false,
      tagIds: [tagIds.side],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: SEED_RECIPE_IDS.buckwheat,
      name: 'Buckwheat kasha',
      yield: { value: 4, unit: 'serving' },
      defaultPortionPerPerson: { value: 1, unit: 'serving' },
      ingredientLines: [
        line(ids.buckwheat, 'buckwheat', 300, 'g'),
        line(ids.salt, 'salt', 0.5, 'tsp'),
        line(ids.oil, 'cooking oil', 1, 'tsp', 'optional'),
      ],
      instructions:
        'Toast buckwheat briefly if desired. Simmer with salted water until fluffy. Stir in a little oil to finish.',
      roles: ['side'],
      mealTypes: ['lunch', 'dinner'],
      effort: 'quick',
      activeTimeMinutes: 5,
      totalTimeMinutes: 25,
      reusePolicy: 'same-day',
      freezerFriendly: false,
      tagIds: [tagIds.side],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: SEED_RECIPE_IDS.potatoes,
      name: 'Boiled potatoes',
      yield: { value: 4, unit: 'serving' },
      defaultPortionPerPerson: { value: 1, unit: 'serving' },
      ingredientLines: [line(ids.potato, 'potato', 800, 'g'), line(ids.salt, 'salt', 1, 'tsp')],
      instructions:
        'Peel or scrub potatoes. Boil in salted water until tender. Drain and serve warm.',
      roles: ['side', 'vegetable'],
      mealTypes: ['lunch', 'dinner'],
      effort: 'quick',
      activeTimeMinutes: 10,
      totalTimeMinutes: 30,
      reusePolicy: 'same-day',
      freezerFriendly: false,
      tagIds: [tagIds.side, tagIds.vegetable],
      createdAt: now,
      updatedAt: now,
    },
  ]

  const simpleFoods: SimpleFood[] = [
    {
      id: SEED_SIMPLE_FOOD_IDS.bread,
      ingredientId: ids.bread,
      name: 'Bread',
      defaultPortion: { value: 2, unit: 'piece' },
      roles: ['breakfast-component', 'side'],
      mealTypes: ['breakfast', 'lunch', 'dinner'],
      tagIds: [],
      enabledInSuggestions: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: SEED_SIMPLE_FOOD_IDS.yogurt,
      ingredientId: ids.yogurt,
      name: 'Yogurt',
      defaultPortion: { value: 150, unit: 'g' },
      roles: ['breakfast-component'],
      mealTypes: ['breakfast'],
      tagIds: [],
      enabledInSuggestions: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: SEED_SIMPLE_FOOD_IDS.banana,
      ingredientId: ids.banana,
      name: 'Banana',
      defaultPortion: { value: 1, unit: 'piece' },
      roles: ['breakfast-component'],
      mealTypes: ['breakfast'],
      tagIds: [],
      enabledInSuggestions: true,
      createdAt: now,
      updatedAt: now,
    },
  ]

  return { ingredients, recipes, simpleFoods, tags }
}
