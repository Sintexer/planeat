import type { Recipe, RecipeIngredientLine, RecipeWriteInput } from '../../domain/recipes/Recipe'
import type { Quantity } from '../../domain/shared/Quantity'
import type { TagId } from '../../domain/tags/Tag'

export type RecipeFormIngredientLine = {
  key: string
  name: string
  quantityValue: number | ''
  quantityUnit: string
  note: string
}

export type RecipeFormValues = {
  name: string
  yieldValue: number | ''
  yieldUnit: string
  portionValue: number | ''
  portionUnit: string
  instructions: string
  roles: string[]
  mealTypes: string[]
  effort: string
  activeTimeMinutes: number | ''
  totalTimeMinutes: number | ''
  reusePolicy: string
  freezerFriendly: boolean
  freezingNotes: string
  tagIds: TagId[]
  sourceUrl: string
  photoUrl: string
  cuisine: string
  dishType: string
  maxPreferredRepeats: number | ''
  notes: string
  ingredientLines: RecipeFormIngredientLine[]
}

export function emptyIngredientLine(): RecipeFormIngredientLine {
  return {
    key: crypto.randomUUID(),
    name: '',
    quantityValue: '',
    quantityUnit: 'g',
    note: '',
  }
}

export function defaultRecipeFormValues(): RecipeFormValues {
  return {
    name: '',
    yieldValue: 2,
    yieldUnit: 'serving',
    portionValue: 1,
    portionUnit: 'serving',
    instructions: '',
    roles: ['complete'],
    mealTypes: ['dinner'],
    effort: 'regular',
    activeTimeMinutes: '',
    totalTimeMinutes: '',
    reusePolicy: 'fresh-only',
    freezerFriendly: false,
    freezingNotes: '',
    tagIds: [],
    sourceUrl: '',
    photoUrl: '',
    cuisine: '',
    dishType: '',
    maxPreferredRepeats: '',
    notes: '',
    ingredientLines: [emptyIngredientLine()],
  }
}

export function quantityFromForm(value: number | '', unit: string): Quantity | null {
  if (value === '' || !Number.isFinite(value)) return null
  return { value, unit }
}

export function recipeToFormValues(
  recipe: Recipe,
  ingredientNamesById: Map<string, string>,
): RecipeFormValues {
  return {
    name: recipe.name,
    yieldValue: recipe.yield.value,
    yieldUnit: recipe.yield.unit,
    portionValue: recipe.defaultPortionPerPerson.value,
    portionUnit: recipe.defaultPortionPerPerson.unit,
    instructions: recipe.instructions,
    roles: [...recipe.roles],
    mealTypes: [...recipe.mealTypes],
    effort: recipe.effort,
    activeTimeMinutes: recipe.activeTimeMinutes ?? '',
    totalTimeMinutes: recipe.totalTimeMinutes ?? '',
    reusePolicy: recipe.reusePolicy,
    freezerFriendly: recipe.freezerFriendly,
    freezingNotes: recipe.freezingNotes ?? '',
    tagIds: [...recipe.tagIds],
    sourceUrl: recipe.sourceUrl ?? '',
    photoUrl: recipe.photoUrl ?? '',
    cuisine: recipe.cuisine ?? '',
    dishType: recipe.dishType ?? '',
    maxPreferredRepeats: recipe.maxPreferredRepeats ?? '',
    notes: recipe.notes ?? '',
    ingredientLines:
      recipe.ingredientLines.length === 0
        ? [emptyIngredientLine()]
        : recipe.ingredientLines.map((line) => ({
            key: crypto.randomUUID(),
            name: ingredientNamesById.get(line.ingredientId) ?? line.displayText,
            quantityValue: line.quantity?.value ?? '',
            quantityUnit: line.quantity?.unit ?? 'g',
            note: line.note ?? '',
          })),
  }
}

export function buildPartialWriteFromForm(values: RecipeFormValues): {
  base: Omit<RecipeWriteInput, 'ingredientLines'>
  lines: RecipeFormIngredientLine[]
} | null {
  const yieldQty = quantityFromForm(values.yieldValue, values.yieldUnit)
  const portionQty = quantityFromForm(values.portionValue, values.portionUnit)
  if (!yieldQty || !portionQty) return null

  return {
    base: {
      name: values.name.trim(),
      yield: yieldQty,
      defaultPortionPerPerson: portionQty,
      instructions: values.instructions,
      roles: values.roles as RecipeWriteInput['roles'],
      mealTypes: values.mealTypes as RecipeWriteInput['mealTypes'],
      effort: values.effort as RecipeWriteInput['effort'],
      activeTimeMinutes:
        values.activeTimeMinutes === '' ? undefined : Number(values.activeTimeMinutes),
      totalTimeMinutes:
        values.totalTimeMinutes === '' ? undefined : Number(values.totalTimeMinutes),
      reusePolicy: values.reusePolicy as RecipeWriteInput['reusePolicy'],
      freezerFriendly: values.freezerFriendly,
      freezingNotes: values.freezingNotes.trim() || undefined,
      tagIds: values.tagIds,
      sourceUrl: values.sourceUrl.trim() || undefined,
      photoUrl: values.photoUrl.trim() || undefined,
      cuisine: values.cuisine.trim() || undefined,
      dishType: values.dishType || undefined,
      maxPreferredRepeats:
        values.maxPreferredRepeats === '' ? undefined : Number(values.maxPreferredRepeats),
      notes: values.notes.trim() || undefined,
    },
    lines: values.ingredientLines.filter((line) => line.name.trim().length > 0),
  }
}

export function formLineToIngredientLine(
  line: RecipeFormIngredientLine,
  ingredientId: string,
): RecipeIngredientLine {
  return {
    ingredientId,
    quantity: quantityFromForm(line.quantityValue, line.quantityUnit),
    note: line.note.trim() || undefined,
    displayText: line.name.trim(),
  }
}
