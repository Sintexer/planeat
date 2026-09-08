export type IngredientId = string

export interface Ingredient {
  id: IngredientId
  name: string
  aliases: string[]
  category?: string
  isCommon: boolean
  createdAt: number
  updatedAt: number
}

export function normalizeIngredientName(name: string): string {
  return name.trim().toLowerCase()
}

export function ingredientMatchesName(ingredient: Ingredient, rawName: string): boolean {
  const needle = normalizeIngredientName(rawName)
  if (!needle) return false
  if (normalizeIngredientName(ingredient.name) === needle) return true
  return ingredient.aliases.some((alias) => normalizeIngredientName(alias) === needle)
}
