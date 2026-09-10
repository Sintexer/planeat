/** Loose Schema.org Recipe node after JSON-LD walk (runtime-validated in infra). */
export type SchemaOrgRecipeNode = {
  '@type'?: string | string[]
  name?: string | string[]
  recipeIngredient?: unknown
  ingredients?: unknown
  recipeInstructions?: unknown
  instructions?: unknown
  recipeYield?: unknown
  yield?: unknown
  prepTime?: unknown
  cookTime?: unknown
  totalTime?: unknown
  url?: unknown
  mainEntityOfPage?: unknown
  description?: unknown
  [key: string]: unknown
}

export type ExtractRecipesError = 'empty' | 'url-only' | 'parse-failed' | 'no-recipe'

export type ExtractRecipesResult =
  { ok: true; recipes: SchemaOrgRecipeNode[] } | { ok: false; error: ExtractRecipesError }

export interface RecipeTextExtractor {
  extractRecipesFromText(raw: string): ExtractRecipesResult
}
